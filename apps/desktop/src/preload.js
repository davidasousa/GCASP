// File For Exposing IPC Functions
import electron, { contextBridge, ipcRenderer } from 'electron';

// Invoke - Send Events

// Exposing IPC API To Electron React
contextBridge.exposeInMainWorld('electron', {
	// Generic Event Main, -> Renderer
  execTrigger: (channel) => ipcRenderer.invoke(channel),

	// Fetch Video Event, With Filepath Argument
	fetchVideo: (filePath) => ipcRenderer.invoke('trigger-video-fetch', filePath),

	// Exposing IPC Renderer
	onTriggerVideoFetch: (callback) => ipcRenderer.on('trigger-new-video', (event, value) => callback(value))

});
