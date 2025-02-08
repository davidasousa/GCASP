// File For Exposing IPC Functions
import electron, { contextBridge, ipcRenderer } from 'electron';

// Invoke - Send Events From Main To Renderer
// On - Listen From Events From Renderer In Main

contextBridge.exposeInMainWorld('electron', {
	// Generic Event Main, -> Renderer
  recordVideo: (channel) => ipcRenderer.invoke(channel),

	// Fetch Video Event, With Filepath Argument
	fetchVideo: (filePath) => ipcRenderer.invoke('trigger-video-fetch', filePath),

	// IPC Listener For New Filewrites
	onTriggerVideoFetch: (callback) => ipcRenderer.on(
		'trigger-new-video', (event, value) => callback(value)
	)
});
