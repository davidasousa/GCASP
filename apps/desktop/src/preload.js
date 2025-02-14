// File For Exposing IPC Functions
import electron, { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
	// Invoke Record
  triggerRecordVideo: (videoID) => ipcRenderer.invoke('trigger-record', videoID),

	// Invoke Fetch Video With Given Filepath
	triggerFetchVideo: (path, videoID) => ipcRenderer.invoke('trigger-video-fetch', path, videoID),

	// IPC Listener For New Filewrites
	onTriggerVideoFetch: (callback) => ipcRenderer.once(
		'trigger-new-video', (event, value) => callback(value)
	)

});
