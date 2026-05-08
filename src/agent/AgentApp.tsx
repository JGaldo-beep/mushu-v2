import { listen } from "@/lib/events";
import { Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ThinkingDots } from "@/overlay/components/ThinkingDots";
import { cn } from "@/lib/utils";

type AgentMode = "agent" | "email" | "translate" | "summarize";

const QUICK_ACTIONS: Array<{ label: string; instruction: string; mode: AgentMode }> = [
  {
    label: "Translate to English",
    instruction: "Translate the selected text into clear, natural English. Return only the translation.",
    mode: "translate",
  },
  {
    label: "Reply as email",
    instruction: "Write a professional reply email in the same language as the selected text. Return only the email body.",
    mode: "email",
  },
  {
    label: "Make professional",
    instruction: "Rewrite the selected text in a more professional tone, keeping the original language and meaning.",
    mode: "agent",
  },
  {
    label: "Summarize",
    instruction: "Summarize the selected text in 2-3 short bullet points in the same language.",
    mode: "summarize",
  },
];

async function cancelAgent() {
  try {
    await window.mushu.invoke("agent_cancel");
  } catch {
    /* ignore */
  }
}

export function AgentApp() {
  const [selectedText, setSelectedText] = useState("");
  const [instruction, setInstruction] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onBackdropPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target === e.currentTarget) void cancelAgent();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void cancelAgent();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    let disposed = false;

    const trackUnlisten = (promise: Promise<() => void>) => {
      void promise.then((unlisten) => {
        if (disposed) {
          unlisten();
          return;
        }
        unsubs.push(unlisten);
      });
    };

    trackUnlisten(
      listen<{ text?: string; error?: string | null }>("agent_selection", (e) => {
        const p = e.payload || {};
        setSelectedText(String(p.text || ""));
        setInstruction("");
        setError(p.error ?? null);
        setProcessing(false);
        setTimeout(() => inputRef.current?.focus(), 60);
      }),
    );

    trackUnlisten(
      listen<{ active?: boolean }>("agent_processing", (e) => {
        setProcessing(Boolean(e.payload?.active));
      }),
    );

    trackUnlisten(
      listen<string | { message?: string }>("agent_error", (e) => {
        const p = e.payload;
        setProcessing(false);
        const msg =
          typeof p === "string"
            ? p
            : p && typeof p === "object" && typeof p.message === "string"
              ? p.message
              : "Error en el agente.";
        setError(msg);
      }),
    );

    trackUnlisten(
      listen("agent_done", () => {
        setProcessing(false);
      }),
    );

    return () => {
      disposed = true;
      for (const u of unsubs) u();
    };
  }, []);

  const submit = useCallback(
    async (instr: string, mode: AgentMode) => {
      const text = selectedText.trim();
      const trimmedInstr = instr.trim();
      if (!text) {
        setError("No hay texto seleccionado.");
        return;
      }
      if (!trimmedInstr) {
        setError("Escribe una instrucción o usa una acción rápida.");
        return;
      }
      setError(null);
      setProcessing(true);
      try {
        await window.mushu.invoke("agent_submit", {
          selectedText: text,
          instruction: trimmedInstr,
          mode,
        });
      } catch (e) {
        setProcessing(false);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [selectedText],
  );

  const limeAccent = "oklch(0.86 0.21 122)";

  return (
    <div
      role="presentation"
      className="flex h-full w-full cursor-default items-center justify-center bg-black/45 p-4"
      onPointerDown={onBackdropPointerDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-title"
        className={cn(
          "overlay-pill-surface text-foreground relative w-full max-w-[560px] cursor-auto rounded-xl",
          "shadow-[var(--overlay-pill-shadow)]",
        )}
        onPointerDown={(e) => e.stopPropagation()}
        style={{ borderRadius: 14 }}
      >
        <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
          <h2 id="agent-title" className="text-sm font-medium tracking-tight text-foreground/90">
            Mushu Agent
          </h2>
          <button
            type="button"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
            aria-label="Cerrar"
            onClick={() => void cancelAgent()}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="px-3 pt-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/45">
            Selección
          </div>
          <div
            className={cn(
              "mt-1 max-h-[120px] min-h-[44px] overflow-y-auto rounded-md border border-border/40 bg-black/30 p-2 text-xs leading-relaxed",
              selectedText ? "text-foreground/90" : "text-foreground/50",
            )}
          >
            {selectedText ? (
              <span className="select-text whitespace-pre-wrap">{selectedText}</span>
            ) : (
              <span className="text-destructive">No hay texto seleccionado.</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 px-3 pt-3">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              type="button"
              disabled={processing || !selectedText}
              onClick={() => void submit(a.instruction, a.mode)}
              className={cn(
                "rounded-md border border-border/40 bg-black/30 px-2 py-2 text-xs font-medium text-foreground/90 transition",
                "hover:border-white/40 hover:bg-black/50 disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {a.label}
            </button>
          ))}
        </div>

        <form
          className="flex items-center gap-2 px-3 pt-3 pb-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(instruction, "agent");
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Tu instrucción..."
            disabled={processing}
            className={cn(
              "flex-1 rounded-md border border-border/40 bg-black/30 px-2.5 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none disabled:opacity-50",
            )}
            style={{ caretColor: limeAccent }}
            onFocus={(e) => (e.currentTarget.style.borderColor = limeAccent)}
            onBlur={(e) => (e.currentTarget.style.borderColor = "")}
          />
          <button
            type="submit"
            disabled={processing || !instruction.trim() || !selectedText}
            className={cn(
              "inline-flex items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-50",
              "hover:brightness-110",
            )}
            style={{ backgroundColor: limeAccent }}
          >
            {processing ? (
              <ThinkingDots className="px-2" />
            ) : (
              <>
                <Send className="size-3.5" />
                Enviar
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => void cancelAgent()}
            disabled={processing}
            className="inline-flex items-center justify-center rounded-md border border-border/40 bg-black/30 px-3 py-2 text-xs font-medium text-foreground/80 transition hover:bg-black/50 disabled:opacity-50"
          >
            Cancelar
          </button>
        </form>

        {error ? (
          <div className="border-t border-border/40 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
