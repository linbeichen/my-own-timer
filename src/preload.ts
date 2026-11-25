import { contextBridge, ipcRenderer } from 'electron';
import type { TimerAPI, Snapshot } from './shared';
const api: TimerAPI = {
  command: (command) => ipcRenderer.send('timer:command', command),
  snapshot: () => ipcRenderer.invoke('timer:snapshot'),
  subscribe: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: Snapshot) =>
      callback(snapshot);
    ipcRenderer.on('timer:state', listener);
    return () => ipcRenderer.removeListener('timer:state', listener);
  },
};
contextBridge.exposeInMainWorld('timer', api);
