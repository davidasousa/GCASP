// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import electron, { contextBridge, ipcRenderer } from 'electron';

// Exposing IPC API To Electron React
contextBridge.exposeInMainWorld('electron', {
	// Call Generic Trigger Without Arguments
  execTrigger: (channel) => ipcRenderer.invoke(channel),

	// Call Fetch Video API With Filepath Argument
	fetchVideo: (filePath) => ipcRenderer.invoke('trigger-video-fetch', filePath),
});
