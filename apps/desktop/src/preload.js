// File For Exposing IPC Functions
import electron, { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
	// Invoke Record
  recordVideo: () => ipcRenderer.invoke('trigger-record'),

	// Invoke Fetch Video With Given Filepath
	fetchVideo: (filePath) => ipcRenderer.invoke('trigger-video-fetch', filePath),

	// IPC Listener For New Filewrites
	onTriggerVideoFetch: (callback) => ipcRenderer.on(
		'trigger-new-video', (event, value) => callback(value)
	)
});
