// File For Exposing IPC Functions
import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
	// Get list of local videos
	getLocalVideos: () => ipcRenderer.invoke('get-local-videos'),

	// Trigger video recording
	triggerRecordVideo: () => ipcRenderer.invoke('trigger-record'),

	// Remove specific video
	removeSpecificVideo: (filename) => ipcRenderer.invoke('remove-specific-video', filename),

	// Get video metadata
	getVideoMetadata: (filename) => ipcRenderer.invoke('get-video-metadata', filename),

	// Save edited video
	saveEditedVideo: (params) => ipcRenderer.invoke('save-edited-video', params),

	// Listen for new recordings
	onNewRecording: (callback) => 
		ipcRenderer.on('new-recording', (event, data) => callback(data))
});