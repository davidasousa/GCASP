// File For Exposing IPC Functions
import electron, { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
	// Invoke Record
  triggerRecordVideo: () => ipcRenderer.invoke('trigger-record'),

	// Invoke Fetch Video With Given Filepath
	triggerFetchVideo: (timestamp) => ipcRenderer.invoke('trigger-video-fetch', timestamp),

	// IPC Listener For New Filewrites
	onTriggerVideoFetch: (callback) => ipcRenderer.once(
		'trigger-new-video', (event, timestamp) => callback(timestamp)
	)

});
