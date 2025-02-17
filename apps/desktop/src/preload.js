// File For Exposing IPC Functions
import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
// Get list of local videos
	getLocalVideos: () => ipcRenderer.invoke('get-local-videos'),

// Trigger video recording
	triggerRecordVideo: () => ipcRenderer.invoke('trigger-record'),

// Listen for new recordings
	onNewRecording: (callback) => 
		ipcRenderer.on('new-recording', (event, data) => callback(data))
});