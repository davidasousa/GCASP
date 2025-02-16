// File For Exposing IPC Functions
import electron, { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
	// Invoke Record
  triggerRecordVideo: () => ipcRenderer.invoke(
		'trigger-record'
	),
	// Invoke Fetch Recording With Given Filepath
	triggerFetchRecording: (timestamp) => ipcRenderer.invoke(
		'trigger-recording-fetch', timestamp
	),
	// Invoke Fetching Previous Videos
	triggerFetchPrevVideos: () => ipcRenderer.invoke(
		'trigger-fetch-prev-videos'
	),
	// IPC Listener For New Filewrites
	onTriggerVideoFetch: (callback) => ipcRenderer.once(
		'trigger-new-video', (event, timestamp) => callback(timestamp)
	)
});
