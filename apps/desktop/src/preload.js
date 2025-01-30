// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

// Exposing Function 
contextBridge.exposeInMainWord('electron', {
  getData: () => ipcRenderer.invoke('trigger'),
});
