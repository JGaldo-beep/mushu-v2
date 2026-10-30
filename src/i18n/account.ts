// `status` is the entitlement status from the backend: "trial" (free) or "active" (Pro).
// Anything else is shown as-is.
const en = {
  planName: (status: string): string =>
    status === "trial" ? "Free trial" : status === "active" ? "Mushu Pro" : status,
  title: "Account",
  subtitle: "Managed on the web, synced to this computer",
  yourAccount: "your account",
  signedInAs: (label: string) => `Signed in as ${label}`,
  signedOut: "Signed out",
  refreshed: "Account refreshed",
  avatar: "Avatar",
  notSignedIn: "Not signed in",
  planSummary: (plan: string, minutes: number | null) =>
    minutes === null ? plan : `${plan} · ${minutes} min available`,
  syncPending: "Account connected · sync pending",
  connectForTrial: "Connect your account to start the trial",
  syncingMinutes: "Syncing minutes",
  minutesRemaining: (n: number) => `${n} minutes remaining`,
  waitingTitle: "Waiting for sign-in…",
  waitingBody:
    "Finish signing in in your browser. Mushu picks it up automatically, so you don't need to come back here.",
  reopenBrowser: "Reopen browser",
  cancel: "Cancel",
  signInTitle: "Sign in on the web",
  signInBody:
    "Your account, billing and plan live on mushu.space. Sign in there and your browser hands the session back to this app, with no second password.",
  signInButton: "Sign in on the web",
  noAccount: "Don't have an account?",
  createAccount: "Create one on the web",
  planCardTitle: (status: string | null): string =>
    status === "active" ? "Mushu Pro active" : "Free trial active",
  minutesUnknown: "Refresh to see your available minutes.",
  minutesAvailable: (n: number) =>
    `You have ${n} minutes available. Each dictation uses seconds from your plan.`,
  refreshMinutes: "Refresh minutes",
  billingTitle: "Billing and plan",
  billingBody: "Managed on the web. This app uses whatever plan is active.",
  openOnWeb: "Open on the web",
  signOut: "Sign out",
};

const es: typeof en = {
  planName: (status: string): string =>
    status === "trial" ? "Prueba gratis" : status === "active" ? "Mushu Pro" : status,
  title: "Cuenta",
  subtitle: "Se gestiona en la web y se sincroniza con este computador",
  yourAccount: "tu cuenta",
  signedInAs: (label: string) => `Sesión iniciada como ${label}`,
  signedOut: "Sesión cerrada",
  refreshed: "Cuenta actualizada",
  avatar: "Foto de perfil",
  notSignedIn: "Sin sesión iniciada",
  planSummary: (plan: string, minutes: number | null) =>
    minutes === null ? plan : `${plan} · ${minutes} min disponibles`,
  syncPending: "Cuenta conectada · sincronizando",
  connectForTrial: "Conecta tu cuenta para empezar la prueba",
  syncingMinutes: "Sincronizando minutos",
  minutesRemaining: (n: number) => `Te quedan ${n} minutos`,
  waitingTitle: "Esperando que inicies sesión…",
  waitingBody:
    "Termina de iniciar sesión en tu navegador. Mushu lo detecta solo, no hace falta que vuelvas aquí.",
  reopenBrowser: "Abrir el navegador otra vez",
  cancel: "Cancelar",
  signInTitle: "Inicia sesión en la web",
  signInBody:
    "Tu cuenta, tus pagos y tu plan están en mushu.space. Inicia sesión ahí y el navegador le pasa la sesión a esta app, sin otra contraseña.",
  signInButton: "Iniciar sesión en la web",
  noAccount: "¿No tienes cuenta?",
  createAccount: "Créala en la web",
  planCardTitle: (status: string | null): string =>
    status === "active" ? "Mushu Pro activo" : "Prueba gratis activa",
  minutesUnknown: "Actualiza para ver tus minutos disponibles.",
  minutesAvailable: (n: number) =>
    `Tienes ${n} minutos disponibles. Cada dictado descuenta segundos de tu plan.`,
  refreshMinutes: "Actualizar minutos",
  billingTitle: "Pagos y plan",
  billingBody: "Se gestiona en la web. Esta app usa el plan que tengas activo.",
  openOnWeb: "Abrir en la web",
  signOut: "Cerrar sesión",
};

export const accountCopy = { en, es };
