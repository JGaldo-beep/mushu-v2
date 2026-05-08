// Lanza Electron limpiando ELECTRON_RUN_AS_NODE.
// Esa env var (a veces heredada de procesos padres como editores Electron-based)
// fuerza a Electron a comportarse como Node plano y rompe el main process.
const { spawn } = require("node:child_process");
const electronBinary = require("electron");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, ["."].concat(process.argv.slice(2)), {
  stdio: "inherit",
  env,
  windowsHide: false,
});

child.on("close", (code, signal) => {
  if (code === null) {
    console.error(electronBinary, "exited with signal", signal);
    process.exit(1);
  }
  process.exit(code);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => child.kill(sig));
}
