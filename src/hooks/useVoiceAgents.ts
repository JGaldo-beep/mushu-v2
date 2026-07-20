import { listen } from "@/lib/events";
import { useCallback, useEffect, useState } from "react";
import { tauri } from "@/lib/tauri";
import type { VoiceAgent } from "@/lib/types";

export function useVoiceAgents() {
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const fs = await tauri.getFrontendState();
      setAgents(fs.voice_agents ?? []);
      setActiveAgentId(fs.active_voice_agent_id ?? null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen("frontend_state_changed", () => {
      void load();
    }).then((u) => {
      unlisten = u;
    });
    return () => {
      unlisten?.();
    };
  }, [load]);

  const saveAgent = useCallback(async (input: { id?: string; name: string; instruction: string }) => {
    const fs = await tauri.saveVoiceAgent(input);
    setAgents(fs.voice_agents ?? []);
    setActiveAgentId(fs.active_voice_agent_id ?? null);
    return fs;
  }, []);

  const deleteAgent = useCallback(async (id: string) => {
    const fs = await tauri.deleteVoiceAgent(id);
    setAgents(fs.voice_agents ?? []);
    setActiveAgentId(fs.active_voice_agent_id ?? null);
    return fs;
  }, []);

  const setActiveAgent = useCallback(async (id: string | null) => {
    setActiveAgentId(id);
    try {
      const fs = await tauri.setActiveVoiceAgent(id);
      setAgents(fs.voice_agents ?? []);
      setActiveAgentId(fs.active_voice_agent_id ?? null);
    } catch (err) {
      await load();
      throw err;
    }
  }, [load]);

  const activeAgent = agents.find((a) => a.id === activeAgentId) ?? null;

  return {
    agents,
    activeAgentId,
    activeAgent,
    loading,
    saveAgent,
    deleteAgent,
    setActiveAgent,
    refresh: load,
  };
}
