// File For Exposing IPC Functions
import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
// Get list of local videos
	getLocalVideos: () => ipcRenderer.invoke('get-local-videos'),
	
// Remove All Local Videos
	removeLocalVideos: () => ipcRenderer.invoke('remove-local-videos'),

// Remove Specific Video
	removeSpecificVideo: (file) => ipcRenderer.invoke('remove-specific-video', file),

// Trigger video recording
	triggerRecordVideo: () => ipcRenderer.invoke('trigger-record'),

// Trigger video clippings
	triggerClipVideo: () => ipcRenderer.invoke('trigger-clip', clipSettings),

// Listen for new recordings
	onNewRecording: (callback) => 
		ipcRenderer.on('new-recording', (event, data) => callback(data)),

// Listen for new clippings
	onNewClipping: (callback) => 
		ipcRenderer.on('new-clipping', (event, data) => callback(data))
});
