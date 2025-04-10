import { ipcMain } from 'electron';
import { getCurrentSettings, saveSettings, initSettings, onSettingsChanged } from './settings';
import { getModuleLogger } from './logger';
import { restartRecordingWithNewSettings } from './recorder';

const logger = getModuleLogger('ipcSettingsHandlers.js');

// Cache for the current settings
let cachedSettings = null;

// Function reference for registerHotkey that will be set by setupHotkeyCallback
let hotkeyRegistrationCallback = null;

// Set the hotkey registration callback function 
export function setupHotkeyCallback(registerHotkeyFn) {
    hotkeyRegistrationCallback = registerHotkeyFn;
}

// Handle settings changes
export function handleSettingsChanged(newSettings) {
    logger.debug('Settings changed, updating application state...');
    
    // Update cached settings
    const oldSettings = cachedSettings;
    cachedSettings = newSettings;
    
    // Check if hotkey changed
    if (oldSettings && oldSettings.hotkey !== newSettings.hotkey && hotkeyRegistrationCallback) {
        logger.info(`Hotkey changed from ${oldSettings.hotkey} to ${newSettings.hotkey}`);
        hotkeyRegistrationCallback(newSettings.hotkey);
    }
    
    // Check if recording settings changed
    const resolutionChanged = 
        oldSettings && 
        (oldSettings.resolution?.width !== newSettings.resolution?.width || 
        oldSettings.resolution?.height !== newSettings.resolution?.height);
    
    const fpsChanged = oldSettings && oldSettings.fps !== newSettings.fps;
    
    const monitorChanged = oldSettings && oldSettings.selectedMonitor !== newSettings.selectedMonitor;
    
    // If resolution, FPS, or selected monitor changed, restart recording with new settings
    if (resolutionChanged || fpsChanged || monitorChanged) {
        logger.info('Recording settings changed, restarting recording...');
        restartRecordingWithNewSettings().catch(error => {
            logger.error('Failed to restart recording with new settings:', error);
        });
    }
}

// Initialize settings and register handlers
export function setupSettingsHandlers() {
    // Initialize settings
    logger.debug('Initializing settings...');
    cachedSettings = initSettings();
    logger.debug('Settings initialized', cachedSettings);

    // Register for settings changes
    onSettingsChanged(handleSettingsChanged);

    // Get settings handler
    logger.debug('Registering get-settings handler');
    ipcMain.handle('get-settings', () => {
        logger.debug('get-settings handler called');
        try {
            logger.debug('Returning cached settings');
            return cachedSettings || getCurrentSettings();
        } catch (error) {
            logger.error('Error getting settings:', error);
            throw error;
        }
    });

    // Save settings handler
    logger.debug('Registering save-settings handler');
    ipcMain.handle('save-settings', async (event, newSettings) => {
        logger.debug('save-settings handler called', { newSettings });
        try {
            // Save the new settings - the saveSettings function will handle updating the cache
            logger.debug('Saving new settings...');
            const success = saveSettings(newSettings);
            logger.info(`Settings save ${success ? 'successful' : 'failed'}`);
            
            return { success };
        } catch (error) {
            logger.error('Error saving settings:', error);
            return { success: false, error: error.message };
        }
    });
}

// Get cached settings
export function getCachedSettings() {
    return cachedSettings;
}