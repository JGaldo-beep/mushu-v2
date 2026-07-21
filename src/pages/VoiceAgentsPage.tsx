import { Bot, Check, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
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
import type { VoiceAgent } from "@/lib/types";

const AGENT_COLOR = "#737373";

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
          <DialogTitle>{agent ? "Edit voice agent" : "New voice agent"}</DialogTitle>
          <DialogDescription>
            Give it a name and an instruction — this is the "voice" applied to your dictation
            whenever this agent is active.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Partner Post on X"
              maxLength={60}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Instruction</label>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleImprove}
                disabled={improving || !instruction.trim()}
              >
                <Sparkles size={12} strokeWidth={2.25} />
                {improving ? "Improving..." : "Improve with AI"}
              </Button>
            </div>
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Rewrite the dictated idea as an English X/Twitter post, concise and confident tone, no hashtags."
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
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim() || !instruction.trim()}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VoiceAgentsPage() {
  const { agents, activeAgentId, saveAgent, deleteAgent, setActiveAgent } = useVoiceAgents();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<VoiceAgent | null>(null);
  // Bumped on every open so AgentDialog fully remounts and its local form
  // state (useState initializers) picks up the current `agent` prop fresh,
  // instead of reusing stale state from a previous open of the dialog.
  const [dialogSession, setDialogSession] = useState(0);

  const openCreate = () => {
    setEditingAgent(null);
    setDialogSession((n) => n + 1);
    setDialogOpen(true);
  };

  const openEdit = (agent: VoiceAgent, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAgent(agent);
    setDialogSession((n) => n + 1);
    setDialogOpen(true);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteAgent(id).catch(() => {});
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
              Voice Agents
            </p>
            <p
              style={{
                fontFamily: "'Geist Variable', sans-serif",
                fontSize: "12px",
                fontWeight: 450,
                color: "var(--text-muted)",
              }}
            >
              Custom presets that rewrite your dictation in a specific voice
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} strokeWidth={2.5} />
          New Agent
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {agents.length === 0 ? (
          <GlassCard className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <Bot size={28} strokeWidth={1.75} style={{ color: "var(--text-muted)" }} />
            <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              No voice agents yet.
            </p>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Create one to turn a raw dictation into a ready-to-paste post, in whatever voice you configure.
            </p>
            <Button size="sm" onClick={openCreate} className="mt-2">
              <Plus size={14} strokeWidth={2.5} />
              New Agent
            </Button>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {agents.map((agent) => {
              const isActive = activeAgentId === agent.id;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => toggleActive(agent)}
                  className="group text-left"
                  style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
                >
                  <GlassCard
                    variant={isActive ? "strong" : "default"}
                    className="relative flex flex-col gap-3 p-5 transition-all"
                    style={{
                      minHeight: "180px",
                      border: isActive
                        ? `0.5px solid ${AGENT_COLOR}55`
                        : "0.5px solid var(--glass-border-outer)",
                      boxShadow: isActive
                        ? `inset 0 1px 0 var(--glass-border), 0 0 0 1px ${AGENT_COLOR}40, 0 8px 24px rgba(0,0,0,0.30)`
                        : "inset 0 1px 0 var(--glass-border), 0 1px 2px rgba(0,0,0,0.20), 0 8px 24px rgba(0,0,0,0.28)",
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "12px",
                          background: `${AGENT_COLOR}14`,
                          border: `0.5px solid ${AGENT_COLOR}30`,
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
                              background: `${AGENT_COLOR}14`,
                              border: `0.5px solid ${AGENT_COLOR}40`,
                              color: AGENT_COLOR,
                              fontFamily: "'Space Mono', monospace",
                              fontSize: "9px",
                              textTransform: "uppercase",
                              letterSpacing: "0.1em",
                              fontWeight: 700,
                            }}
                          >
                            <Check size={10} strokeWidth={3} />
                            Active
                          </span>
                        )}
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => openEdit(agent, e)}
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                          style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--text-muted)",
                          }}
                        >
                          <Pencil size={13} strokeWidth={2} />
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => handleDelete(agent.id, e)}
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                          style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--text-muted)",
                          }}
                        >
                          <Trash2 size={13} strokeWidth={2} />
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
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
                    </div>
                  </GlassCard>
                </button>
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
          Activating an agent replaces normal mode formatting: every dictation is rewritten with
          that agent's instruction until you deactivate it (click the active card again) or pick
          another one.
        </p>
      </div>

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
