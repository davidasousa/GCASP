// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import electron, { contextBridge, ipcRenderer } from 'electron';

// Exposing IPC API To React
contextBridge.exposeInMainWorld('electron', {
  execTrigger: (channel) => ipcRenderer.invoke(channel)
});
