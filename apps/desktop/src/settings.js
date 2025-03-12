import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { getModuleLogger } from './logger';

const logger = getModuleLogger('settings.js');

// Define path for GCASP settings
const gcaspDataPath = path.join(app.getPath('appData'), 'GCASP');
const settingsPath = path.join(gcaspDataPath, 'settings.json');

logger.debug(`Settings module initialized - Path: ${settingsPath}`);

// Default settings
const defaultSettings = {
	hotkey: 'F9',
	recordingLength: 20, // seconds
	resolution: { width: 1920, height: 1080 },
	fps: 30
};

// Create a cache of the current settings
let settingsCache = null;
let fileWatcher = null;
let settingsChangeCallbacks = [];

// Notify both renderer processes and main process callbacks about settings changes
function notifySettingsChanged(settings) {
	logger.debug(`Notifying about settings changes`);
	
	// 1. Notify all BrowserWindows (renderer processes)
	const windows = BrowserWindow.getAllWindows();
	windows.forEach(window => {
		if (!window.isDestroyed()) {
			logger.debug(`Sending settings-changed event to window ${window.id}`);
			window.webContents.send('settings-changed', settings);
		}
	});
	
	// 2. Notify registered callbacks in the main process
	logger.debug(`Notifying ${settingsChangeCallbacks.length} main process callbacks`);
	settingsChangeCallbacks.forEach(callback => {
		try {
			callback(settings);
		} catch (error) {
			logger.error('Error in settings change callback:', error);
		}
	});
}

// Load settings from the settings file
export function loadSettings() {
	logger.debug('Loading settings...');
	try {
		// Check if settings file exists
		if (fs.existsSync(settingsPath)) {
			logger.debug(`Settings file found at: ${settingsPath}`);
			const settingsData = fs.readFileSync(settingsPath, 'utf8');
			
			try {
				const settings = JSON.parse(settingsData);
				logger.debug('Settings parsed successfully');
				
				// Merge with default settings to ensure all properties exist
				const mergedSettings = { ...defaultSettings, ...settings };
				logger.debug('Merged with default settings', mergedSettings);
				
				// Update cache
				settingsCache = mergedSettings;
				
				return mergedSettings;
			} catch (parseError) {
				logger.error(`Error parsing settings JSON: ${parseError.message}`);
				logger.warn('Using default settings due to parse error');
				
				// Update cache to defaults on error
				settingsCache = { ...defaultSettings };
				
				return defaultSettings;
			}
		}
		
		// If file doesn't exist, return default settings
		logger.info(`Settings file doesn't exist, using defaults`);
		
		// Update cache to defaults
		settingsCache = { ...defaultSettings };
		
		return defaultSettings;
	} catch (error) {
		logger.error('Error loading settings:', error);
		logger.warn('Falling back to default settings');
		
		// Update cache to defaults on error
		settingsCache = { ...defaultSettings };
		
		return defaultSettings;
	}
}

// Save settings to the settings file
export function saveSettings(settings) {
	logger.debug('Saving settings...', settings);
	try {
		// First ensure directory exists
		ensureSettingsDirectory();
		
		// Check if we need to temporarily pause file watcher to avoid self-triggers
		const watcherWasActive = fileWatcher !== null;
		if (watcherWasActive) {
			pauseFileWatcher();
		}
		
		// Merge with existing settings to avoid overwriting unrelated settings
		const existingSettings = settingsCache || loadSettings();
		const updatedSettings = { ...existingSettings, ...settings };
		
		// Check for changes
		const hasChanges = JSON.stringify(existingSettings) !== JSON.stringify(updatedSettings);
		if (!hasChanges) {
			logger.debug('No changes detected in settings, skipping save');
			
			// Resume watcher if it was active
			if (watcherWasActive) {
				resumeFileWatcher();
			}
			
			return true;
		}
		
		// Write settings to file
		logger.debug(`Writing settings to: ${settingsPath}`);
		fs.writeFileSync(settingsPath, JSON.stringify(updatedSettings, null, 2), 'utf8');
		logger.info('Settings saved successfully');
		
		// Update cache
		settingsCache = updatedSettings;
		
		// Log specific changes
		Object.keys(settings).forEach(key => {
			if (JSON.stringify(existingSettings[key]) !== JSON.stringify(settings[key])) {
				logger.debug(`Setting changed: ${key}`, {
					from: existingSettings[key],
					to: settings[key]
				});
			}
		});
		
		// Resume watcher if it was active
		if (watcherWasActive) {
			resumeFileWatcher();
		}
		
		// Notify about the changes
		notifySettingsChanged(updatedSettings);
		
		return true;
	} catch (error) {
		logger.error('Error saving settings:', error);
		
		// Resume watcher if there was an error
		if (fileWatcher === null) {
			resumeFileWatcher();
		}
		
		return false;
	}
}

// Ensure the settings directory exists
export function ensureSettingsDirectory() {
	logger.debug(`Ensuring settings directory exists: ${gcaspDataPath}`);
	try {
		// Create GCASP directory if it doesn't exist
		if (!fs.existsSync(gcaspDataPath)) {
			logger.info(`Creating settings directory: ${gcaspDataPath}`);
			fs.mkdirSync(gcaspDataPath, { recursive: true });
			logger.info(`Created GCASP settings directory at: ${gcaspDataPath}`);
		} else {
			logger.debug('Settings directory already exists');
		}
		return true;
	} catch (error) {
		logger.error('Error creating settings directory:', error);
		return false;
	}
}

// Initialize settings when app starts
export function initSettings() {
	logger.info('Initializing settings...');
	
	const directoryCreated = ensureSettingsDirectory();
	if (!directoryCreated) {
		logger.warn('Failed to ensure settings directory exists, using in-memory defaults');
		settingsCache = { ...defaultSettings };
		return defaultSettings;
	}
	
	// If settings file doesn't exist, create it with default settings
	if (!fs.existsSync(settingsPath)) {
		logger.info('Settings file not found, creating with defaults');
		if (saveSettings(defaultSettings)) {
			logger.info('Default settings saved successfully');
		} else {
			logger.warn('Failed to save default settings');
		}
	} else {
		logger.debug('Settings file already exists, loading existing settings');
	}
	
	// Load settings
	let settings = loadSettings();
	
	// Repair invalid settings
	const { repaired, repairedSettings } = repairInvalidSettings(settings);
	
	// If repairs were made, save the repaired settings
	if (repaired) {
		logger.info('Saving repaired settings');
		saveSettings(repairedSettings);
		// Use repaired settings
		settings = repairedSettings;
	}
	
	// Set up the file watcher
	setupFileWatcher();
	
	logger.info('Settings initialization complete');
	return settings;
}

// Validate and repair settings to ensure they have proper values
function repairInvalidSettings(settings) {
	logger.debug('Validating and repairing settings if needed...');
	let repaired = false;
	const repairedSettings = { ...settings };
	
	// Check hotkey
	if (!settings.hotkey || typeof settings.hotkey !== 'string') {
		logger.warn(`Invalid hotkey setting detected: ${settings.hotkey}, resetting to default`);
		repairedSettings.hotkey = defaultSettings.hotkey;
		repaired = true;
	}
	
	// Check recording length
	if (settings.recordingLength === undefined || 
		typeof settings.recordingLength !== 'number' || 
		settings.recordingLength < 5 || 
		settings.recordingLength > 120) {
		logger.warn(`Invalid recordingLength setting detected: ${settings.recordingLength}, resetting to default`);
		repairedSettings.recordingLength = defaultSettings.recordingLength;
		repaired = true;
	}
	
	// Check resolution
	if (!settings.resolution || 
		!settings.resolution.width || 
		!settings.resolution.height || 
		typeof settings.resolution.width !== 'number' || 
		typeof settings.resolution.height !== 'number') {
		logger.warn(`Invalid resolution setting detected: ${JSON.stringify(settings.resolution)}, resetting to default`);
		repairedSettings.resolution = { ...defaultSettings.resolution };
		repaired = true;
	}
	
	// Check FPS
	const validFpsValues = [30, 60];
	if (settings.fps === undefined || 
		typeof settings.fps !== 'number' || 
		!validFpsValues.includes(settings.fps)) {
		logger.warn(`Invalid fps setting detected: ${settings.fps}, resetting to default`);
		repairedSettings.fps = defaultSettings.fps;
		repaired = true;
	}
	
	// Check selectedMonitor (if present)
	if (settings.selectedMonitor !== undefined && 
		(typeof settings.selectedMonitor !== 'string' || 
		!/^\d+$/.test(settings.selectedMonitor))) {
		logger.warn(`Invalid selectedMonitor setting detected: ${settings.selectedMonitor}, resetting to default`);
		repairedSettings.selectedMonitor = "0"; // Default to primary monitor
		repaired = true;
	}
	
	if (repaired) {
		logger.info('Invalid settings were detected and repaired');
	} else {
		logger.debug('All settings are valid, no repairs needed');
	}
	
	return { repaired, repairedSettings };
}

// Set up a file watcher to monitor settings.json for changes
function setupFileWatcher() {
	if (fileWatcher) {
		// Already watching
		return;
	}
	
	// Make sure the directory and file exist
	ensureSettingsDirectory();
	if (!fs.existsSync(settingsPath)) {
		saveSettings(defaultSettings);
	}
	
	try {
		logger.debug(`Setting up file watcher for: ${settingsPath}`);
		
		// Use fs.watchFile instead of fs.watch for better cross-platform compatibility
		fileWatcher = fs.watchFile(settingsPath, { interval: 1000 }, (curr, prev) => {
			// Only process if modification time has changed
			if (curr.mtime.getTime() !== prev.mtime.getTime()) {
				logger.info('Settings file changed on disk, reloading');
				handleFileChange();
			}
		});
		
		logger.info('Settings file watcher initialized');
		return true;
	} catch (error) {
		logger.error('Error setting up settings file watcher:', error);
		return false;
	}
}

// Handle settings file changes
function handleFileChange() {
	try {
		// Load new settings
		const newSettings = loadSettings();
		
		// Repair if needed
		const { repaired, repairedSettings } = repairInvalidSettings(newSettings);
		
		// Update with repaired settings if needed
		if (repaired) {
			logger.info('Repairing invalid settings from file change');
			saveSettings(repairedSettings);
			settingsCache = repairedSettings;
		} else {
			// Just update cache
			settingsCache = newSettings;
			
			// Notify about changes
			notifySettingsChanged(newSettings);
		}
		
		logger.info('Settings file change processed successfully');
	} catch (error) {
		logger.error('Error processing settings file change:', error);
	}
}

// Pause file watcher temporarily (used during saves to prevent self-triggering)
function pauseFileWatcher() {
	if (fileWatcher) {
		fs.unwatchFile(settingsPath);
		fileWatcher = null;
		logger.debug('Settings file watcher paused');
	}
}

// Resume file watcher after pausing
function resumeFileWatcher() {
	if (!fileWatcher) {
		setupFileWatcher();
		logger.debug('Settings file watcher resumed');
	}
}

// Clean up when app exits
export function cleanupSettings() {
	if (fileWatcher) {
		fs.unwatchFile(settingsPath);
		fileWatcher = null;
		logger.debug('Settings file watcher stopped');
	}
}

// Register for settings change notifications in main process
export function onSettingsChanged(callback) {
	if (typeof callback === 'function' && !settingsChangeCallbacks.includes(callback)) {
		settingsChangeCallbacks.push(callback);
		logger.debug(`Registered new settings change callback, total: ${settingsChangeCallbacks.length}`);
		return true;
	}
	return false;
}

// Unregister from settings change notifications
export function offSettingsChanged(callback) {
	const index = settingsChangeCallbacks.indexOf(callback);
	if (index !== -1) {
		settingsChangeCallbacks.splice(index, 1);
		logger.debug(`Unregistered settings change callback, remaining: ${settingsChangeCallbacks.length}`);
		return true;
	}
	return false;
}

// Get current settings without reading from disk
export function getCurrentSettings() {
	return settingsCache || loadSettings();
}