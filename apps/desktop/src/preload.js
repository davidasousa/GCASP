// File For Exposing IPC Functions
import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
// Get list of local videos
	getLocalVideos: () => ipcRenderer.invoke('get-local-videos'),
	
// Remove All Local Videos
	removeLocalClips: () => ipcRenderer.invoke('remove-local-clips'),

// Trigger video recording
	triggerRecordVideo: () => ipcRenderer.invoke('trigger-record'),

// Remove specific video
	removeSpecificVideo: (filename) => ipcRenderer.invoke('remove-specific-video', filename),

// Trigger video clippings
	triggerClipVideo: (clipTimestamp, clipSettings) => ipcRenderer.invoke(
		'trigger-clip', clipTimestamp, clipSettings
	),

// Listen for new recordings
	onRecordingDone: (callback) => 
		ipcRenderer.on('recording-done', (event, data) => callback(data)),

// Listen for new clippings
	onClipDone: (callback) => 
		ipcRenderer.on('clip-done', (event, data) => callback(data)),

});
