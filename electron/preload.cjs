// Hands the game its desktop platform (src/platform/index.ts reads window.svsNative before the game boots):
// a QUIT that closes the app, and fullscreen that drives the real window, so the Options toggle and F11 /
// Alt+Enter agree. Storage stays the web version (localStorage in the app's data folder).
const { contextBridge, ipcRenderer } = require('electron');

let full = false;
const fullscreenListeners = [];
ipcRenderer.on('svs:fullscreen', (_e, on) => {
  full = !!on;
  for (const cb of fullscreenListeners) cb(full);
});

contextBridge.exposeInMainWorld('svsNative', {
  id: 'electron',
  fullscreen: {
    supported: () => true,
    isOn: () => full,
    set: on => ipcRenderer.invoke('svs:set-fullscreen', !!on),
    onChange: cb => { fullscreenListeners.push(cb); },
  },
  lifecycle: {
    canQuit: true,
    quit: () => ipcRenderer.send('svs:quit'),
  },
});
