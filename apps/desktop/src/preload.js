// File For Exposing IPC Functions
import electron, { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
	// Invoke Record
  triggerRecordVideo: () => ipcRenderer.invoke('trigger-record'),

	// Invoke Fetch Video With Given Filepath
	triggerFetchVideo: (filePath) => ipcRenderer.invoke('trigger-video-fetch', filePath),

	// IPC Listener For New Filewrites
	onTriggerVideoFetch: (callback) => ipcRenderer.once(
		'trigger-new-video', (event, value) => callback(value)
	)
});
