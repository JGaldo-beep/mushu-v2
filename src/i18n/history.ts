const en = {
  title: "History",
  subtitle: "Your latest transcriptions",
  search: "Search…",
  clearAll: "Clear all history",
  clearTitle: "Clear history?",
  clearBody: "This removes all transcriptions. It can't be undone.",
  cancel: "Cancel",
  clear: "Clear",
  noMatches: "No matches.",
  today: (date: string) => `Today — ${date}`,
  yesterday: (date: string) => `Yesterday — ${date}`,
  words: (n: number) => (n === 1 ? "1 word" : `${n} words`),
  emptyTitle: "No transcriptions yet",
  emptyBody: "Press the shortcut and dictate. Your transcriptions will show up here.",
  // Badges for HistoryItem.mode_used (see lib/historyDisplay.ts).
  general: "General",
  agent: "Agent",
  agentNamed: (name: string) => `Agent: ${name}`,
  copy: "Copy",
  copied: "Copied",
};

const es: typeof en = {
  title: "Historial",
  subtitle: "Tus últimas transcripciones",
  search: "Buscar…",
  clearAll: "Borrar todo el historial",
  clearTitle: "¿Borrar el historial?",
  clearBody: "Se borran todas las transcripciones. No se puede deshacer.",
  cancel: "Cancelar",
  clear: "Borrar",
  noMatches: "Nada coincide.",
  today: (date: string) => `Hoy — ${date}`,
  yesterday: (date: string) => `Ayer — ${date}`,
  words: (n: number) => (n === 1 ? "1 palabra" : `${n} palabras`),
  emptyTitle: "Aún no hay transcripciones",
  emptyBody: "Presiona el atajo y dicta. Tus transcripciones aparecerán aquí.",
  general: "General",
  agent: "Agente",
  agentNamed: (name: string) => `Agente: ${name}`,
  copy: "Copiar",
  copied: "Copiado",
};

export const historyCopy = { en, es };
export type HistoryCopy = typeof en;
