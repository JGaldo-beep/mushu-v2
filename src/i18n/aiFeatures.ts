const en = {
  title: "AI Features",
  subtitle: "AI layers applied to your transcriptions",
  agentTitle: "Agent mode",
  agentBody:
    "If you select text before dictating, Mushu uses what you say as the instruction and replaces the selection with the result. No extra shortcut or configuration.",
  agentExample:
    'Example: select "Hola, ¿cómo estás?" → hold the shortcut and say "translate to English" → it becomes "Hi, how are you?".',
  translateTitle: "Auto-translate",
  translateBody: "Automatically translates to the selected language.",
  targetLanguage: "Target language",
  footnote: "These features run after your voice is transcribed. Turn them on or off any time.",
};

const es: typeof en = {
  title: "Funciones de IA",
  subtitle: "Capas de IA que se aplican a tus transcripciones",
  agentTitle: "Modo agente",
  agentBody:
    "Si seleccionas texto antes de dictar, Mushu toma lo que dices como instrucción y reemplaza la selección con el resultado. Sin atajos ni ajustes extra.",
  agentExample:
    "Ejemplo: selecciona «Hi, how are you?» → mantén el atajo y di «tradúcelo al español» → se reemplaza por «Hola, ¿cómo estás?».",
  translateTitle: "Traducción automática",
  translateBody: "Traduce automáticamente al idioma que elijas.",
  targetLanguage: "Traducir a",
  footnote: "Estas funciones se aplican después de transcribir tu voz. Actívalas o desactívalas cuando quieras.",
};

export const aiFeaturesCopy = { en, es };
