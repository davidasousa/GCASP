// File For Exposing IPC Functions
import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
	// Get list of local videos
	getLocalVideos: () => ipcRenderer.invoke('get-local-videos'),
	
	// Remove All Local Videos
	removeLocalClips: () => ipcRenderer.invoke('remove-local-clips'),
	
	// Trigger video recording (for buffer)
	triggerRecordVideo: () => ipcRenderer.invoke('trigger-record'),
	
	// Remove specific video
	removeSpecificVideo: (filename) => ipcRenderer.invoke('remove-specific-video', filename),
	
	// Trigger video clipping
	triggerClipVideo: (clipSettings) => ipcRenderer.invoke('trigger-clip', clipSettings),
	
	// Get video metadata (for editing)
	getVideoMetadata: (filename) => ipcRenderer.invoke('get-video-metadata', filename),
	
	// Save edited video
	saveEditedVideo: (params) => ipcRenderer.invoke('save-edited-video', params),
	
	// Listen for new recordings
	onNewRecording: (callback) => 
		ipcRenderer.on('new-recording', (event, data) => callback(data)),
		
	// Listen for clip completion
	onClipDone: (callback) => 
		ipcRenderer.on('clip-done', (event, data) => callback(data))
});