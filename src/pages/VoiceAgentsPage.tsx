import { Bot, Check, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GlassCard } from "@/components/GlassCard";
import { tauri } from "@/lib/tauri";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useVoiceAgents } from "@/hooks/useVoiceAgents";
import { useCopy } from "@/i18n";
import { voiceAgentsCopy } from "@/i18n/voiceAgents";
import type { VoiceAgent } from "@/lib/types";

const AGENT_COLOR = "var(--primary)";
/** Token-driven tint. The old `${AGENT_COLOR}14` hex-alpha trick can't work with var(). */
const agentTint = (percent: number) =>
  `color-mix(in oklab, ${AGENT_COLOR} ${percent}%, transparent)`;

function AgentDialog({
  open,
  onOpenChange,
  agent,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: VoiceAgent | null;
  onSave: (input: { id?: string; name: string; instruction: string }) => Promise<unknown>;
}) {
  const t = useCopy(voiceAgentsCopy);
  const [name, setName] = useState(agent?.name ?? "");
  const [instruction, setInstruction] = useState(agent?.instruction ?? "");
  const [saving, setSaving] = useState(false);
  const [improving, setImproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImprove = async () => {
    setImproving(true);
    setError(null);
    try {
      const improved = await tauri.improveVoiceAgentInstruction(instruction, name);
      setInstruction(improved);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setImproving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({ id: agent?.id, name: name.trim(), instruction: instruction.trim() });
      onOpenChange(false);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{agent ? t.dialogEditTitle : t.dialogNewTitle}</DialogTitle>
          <DialogDescription>{t.dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t.name}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePlaceholder}
              maxLength={60}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">{t.instruction}</label>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleImprove}
                disabled={improving || !instruction.trim()}
              >
                <Sparkles size={12} strokeWidth={2.25} />
                {improving ? t.improving : t.improve}
              </Button>
            </div>
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={t.instructionPlaceholder}
              rows={5}
            />
          </div>
          {error && (
            <p className="text-xs" style={{ color: "var(--destructive)" }}>
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim() || !instruction.trim()}>
            {saving ? t.saving : t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Edit/Delete on a card: 40px targets above the card's stretched toggle, visible on hover
// or when anything in the card has keyboard focus.
const AGENT_ACTION =
  "relative z-10 grid size-8 place-items-center rounded-lg text-[var(--text-muted)] opacity-0 transition-[opacity,color,background-color] duration-150 ease-out before:absolute before:-inset-1 hover:bg-[var(--glass-surface)] hover:text-[var(--text-primary)] focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100";

export function VoiceAgentsPage() {
  const t = useCopy(voiceAgentsCopy);
  const { agents, activeAgentId, saveAgent, deleteAgent, setActiveAgent } = useVoiceAgents();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<VoiceAgent | null>(null);
  // Bumped on every open so AgentDialog fully remounts and its local form
  // state (useState initializers) picks up the current `agent` prop fresh,
  // instead of reusing stale state from a previous open of the dialog.
  const [dialogSession, setDialogSession] = useState(0);
  // Deleting throws away a hand-written instruction, so it asks first.
  const [pendingDelete, setPendingDelete] = useState<VoiceAgent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditingAgent(null);
    setDialogSession((n) => n + 1);
    setDialogOpen(true);
  };

  const openEdit = (agent: VoiceAgent) => {
    setEditingAgent(agent);
    setDialogSession((n) => n + 1);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteAgent(pendingDelete.id);
      setPendingDelete(null);
    } catch {
      toast.error(t.deleteFailed);
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = (agent: VoiceAgent) => {
    setActiveAgent(activeAgentId === agent.id ? null : agent.id).catch(() => {});
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="mushu-topbar flex items-center justify-between px-5 py-3"
        style={{ flexShrink: 0 }}
      >
        <div className="flex items-center gap-3">
          <SidebarTrigger style={{ color: "var(--text-secondary)" }} />
          <div>
            <p
              style={{
                fontFamily: "'Geist Variable', sans-serif",
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--text-primary)",
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
              }}
            >
              {t.title}
            </p>
            <p
              style={{
                fontFamily: "'Geist Variable', sans-serif",
                fontSize: "12px",
                fontWeight: 450,
                color: "var(--text-muted)",
              }}
            >
              {t.subtitle}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} strokeWidth={2.5} />
          {t.newAgent}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {agents.length === 0 ? (
          <GlassCard className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <Bot size={28} strokeWidth={1.75} style={{ color: "var(--text-muted)" }} />
            <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              {t.emptyTitle}
            </p>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {t.emptyBody}
            </p>
            <Button size="sm" onClick={openCreate} className="mt-2">
              <Plus size={14} strokeWidth={2.5} />
              {t.newAgent}
            </Button>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {agents.map((agent) => {
              const isActive = activeAgentId === agent.id;
              return (
                // The card is a container: its toggle button stretches over the whole card
                // (click anywhere still activates), and Edit/Delete are real buttons above it.
                <div key={agent.id} className="group relative text-left">
                  <GlassCard
                    variant={isActive ? "strong" : "default"}
                    className="relative flex h-full flex-col gap-3 p-5 transition-[background-color,border-color,box-shadow] duration-150 ease-out"
                    style={{
                      minHeight: "180px",
                      border: isActive
                        ? `0.5px solid ${agentTint(33)}`
                        : "0.5px solid var(--glass-border-outer)",
                      // Theme tokens: the old 28-30% black shadows looked dirty in the light theme.
                      boxShadow: isActive
                        ? `var(--glass-highlight), 0 0 0 1px ${agentTint(25)}, var(--elev-shadow)`
                        : "var(--glass-highlight), var(--elev-shadow)",
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "12px",
                          background: agentTint(8),
                          border: `0.5px solid ${agentTint(19)}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Bot size={20} strokeWidth={2} style={{ color: AGENT_COLOR }} />
                      </div>
                      <div className="flex items-center gap-1">
                        {isActive && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                            style={{
                              background: agentTint(8),
                              border: `0.5px solid ${agentTint(25)}`,
                              color: AGENT_COLOR,
                              fontFamily: "'Space Mono', monospace",
                              fontSize: "9px",
                              textTransform: "uppercase",
                              letterSpacing: "0.1em",
                              fontWeight: 700,
                            }}
                          >
                            <Check size={10} strokeWidth={3} />
                            {t.active}
                          </span>
                        )}
                        {/* Shown on hover, and whenever anything in the card has keyboard focus. */}
                        <button
                          type="button"
                          onClick={() => openEdit(agent)}
                          aria-label={`${t.edit}: ${agent.name}`}
                          title={t.edit}
                          className={AGENT_ACTION}
                        >
                          <Pencil size={13} strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(agent)}
                          aria-label={`${t.delete}: ${agent.name}`}
                          title={t.delete}
                          className={AGENT_ACTION}
                        >
                          <Trash2 size={13} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleActive(agent)}
                      aria-pressed={isActive}
                      className="flex-1 rounded-md text-left before:absolute before:inset-0 before:rounded-[inherit] focus-visible:outline-none focus-visible:before:outline focus-visible:before:outline-2 focus-visible:before:outline-ring"
                    >
                      <h3
                        style={{
                          fontFamily: "'Geist Variable', sans-serif",
                          fontSize: "16px",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          letterSpacing: "-0.01em",
                          marginBottom: "4px",
                        }}
                      >
                        {agent.name}
                      </h3>
                      <p
                        style={{
                          fontFamily: "'Geist Variable', sans-serif",
                          fontSize: "12.5px",
                          fontWeight: 450,
                          color: "var(--text-secondary)",
                          lineHeight: 1.5,
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {agent.instruction}
                      </p>
                    </button>
                  </GlassCard>
                </div>
              );
            })}
          </div>
        )}

        <p
          className="mt-5"
          style={{
            fontFamily: "'Geist Variable', sans-serif",
            fontSize: "11.5px",
            fontWeight: 450,
            color: "var(--text-muted)",
            lineHeight: 1.5,
          }}
        >
          {t.footnote}
        </p>
      </div>

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingDelete ? t.deleteTitle(pendingDelete.name) : ""}</DialogTitle>
            <DialogDescription>{t.deleteBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setPendingDelete(null)}>
              {t.cancel}
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {t.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AgentDialog
        key={dialogSession}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agent={editingAgent}
        onSave={saveAgent}
      />
    </div>
  );
}
