const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mushu", {
  invoke: (command, args) => ipcRenderer.invoke("mushu:invoke", command, args ?? {}),
  on: (event, callback) => {
    const wrapped = (_evt, payload) => callback(payload);
    ipcRenderer.on(event, wrapped);
    return () => ipcRenderer.removeListener(event, wrapped);
  },
  emitAudioChunk: (chunk) => ipcRenderer.send("mushu:audio-chunk", chunk),
});
