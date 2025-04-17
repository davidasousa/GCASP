import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
	// Settings functions
	getSettings: () => ipcRenderer.invoke('get-settings'),
	saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
	onSettingsChanged: (callback) => {
		// Listen for settings-changed event from main process
		ipcRenderer.on('settings-changed', (_, newSettings) => callback(newSettings));
	},
	
	// Toggle tray functionality
	toggleTrayEnabled: (enabled) => ipcRenderer.invoke('toggle-tray-enabled', enabled),
	
	// Screen dimensions
	getScreenDimensions: () => ipcRenderer.invoke('get-screen-dimensions'),

	// Get all monitors
	getMonitors: () => ipcRenderer.invoke('get-monitors'),
	
	// Get list of local videos
	getLocalVideos: () => ipcRenderer.invoke('get-local-videos'),
	
	// Remove All Local Videos
	removeLocalClips: () => ipcRenderer.invoke('remove-local-clips'),
	
	// Trigger video recording (for buffer)
	triggerRecordVideo: () => ipcRenderer.invoke('trigger-record'),
	
	// Remove specific video
	removeSpecificVideo: (filename) => ipcRenderer.invoke('remove-specific-video', filename),
	
	// Trigger video clipping with splicing
	triggerClipVideo: (clipTimestamp, clipSettings) => ipcRenderer.invoke(
		'trigger-clip', clipTimestamp, clipSettings
	),
	
	// Get video metadata (for editing)
	getVideoMetadata: (filename) => ipcRenderer.invoke('get-video-metadata', filename),
	
	// Save edited video
	saveEditedVideo: (params) => ipcRenderer.invoke('save-edited-video', params),
	
	// Start and stop recording functions
	startRecording: () => ipcRenderer.invoke('start-recording'),
	stopRecording: () => ipcRenderer.invoke('stop-recording'),
	
	// Listen for new recordings
	onNewRecording: (callback) => {
		if (callback === null) {
			// Remove listener when null is passed
			ipcRenderer.removeAllListeners('new-recording');
			return;
		}
		// Remove any existing listeners to prevent duplicates
		ipcRenderer.removeAllListeners('new-recording');
		// Add the new listener
		ipcRenderer.on('new-recording', (event, data) => callback(data));
	},
	
	// Listen for recording completion
	onRecordingDone: (callback) => {
		if (callback === null) {
			ipcRenderer.removeAllListeners('recording-done');
			return;
		}
		ipcRenderer.removeAllListeners('recording-done');
		ipcRenderer.on('recording-done', (event, data) => callback(data));
	},
	
	// Listen for clip completion
	onClipDone: (callback) => {
		if (callback === null) {
			ipcRenderer.removeAllListeners('clip-done');
			return;
		}
		ipcRenderer.removeAllListeners('clip-done');
		ipcRenderer.on('clip-done', (event, data) => callback(data));
	},
	
	// Listen for clip errors
	onClipError: (callback) => {
		if (callback === null) {
			ipcRenderer.removeAllListeners('clip-error');
			return;
		}
		ipcRenderer.removeAllListeners('clip-error');
		ipcRenderer.on('clip-error', (event, data) => callback(data));
	},

	// Listen for hotkey press events
	onHotkeyPressed: (callback) => {
		if (callback === null) {
			ipcRenderer.removeAllListeners('hotkey-pressed');
			return;
		}
		ipcRenderer.removeAllListeners('hotkey-pressed');
		ipcRenderer.on('hotkey-pressed', () => callback());
	},

	// Authentication methods
	auth: {
		login: (credentials) => ipcRenderer.invoke('auth-login', credentials),
		register: (userData) => ipcRenderer.invoke('auth-register', userData),
		validateToken: (token) => ipcRenderer.invoke('auth-validate-token', token)
	},

	// Upload Methods
	triggerUploadClip: (title) => ipcRenderer.invoke('trigger-upload-clip', title, token),
	
	// Logging functions for renderer process
	log: {
		error: (message, meta = {}) => ipcRenderer.invoke('log', { level: 'error', message, meta }),
		warn: (message, meta = {}) => ipcRenderer.invoke('log', { level: 'warn', message, meta }),
		info: (message, meta = {}) => ipcRenderer.invoke('log', { level: 'info', message, meta }),
		debug: (message, meta = {}) => ipcRenderer.invoke('log', { level: 'debug', message, meta })
	}
});