import { globalShortcut, BrowserWindow } from 'electron';
import path from 'path';
import { getModuleLogger } from './logger';
import { createClip } from './recorder';
import { setupHotkeyCallback } from './ipcSettingsHandlers';

const logger = getModuleLogger('ipcHotkeyHandlers.js');

// Variable to store the registered hotkey
let registeredHotkey = null;

export function registerHotkey(hotkey) {
    logger.info(`Attempting to register hotkey: ${hotkey}`);
    
    // First unregister any existing hotkeys
    unregisterHotkeys();
    
    // Now register the new hotkey
    try {
        registeredHotkey = hotkey;
        const success = globalShortcut.register(hotkey, async () => {
            logger.info(`Hotkey ${hotkey} pressed - creating clip`);
            
            // Notify all windows immediately that the hotkey was pressed
            const windows = BrowserWindow.getAllWindows();
            windows.forEach(window => {
                if (!window.isDestroyed()) {
                    window.webContents.send('hotkey-pressed');
                }
            });
            
            // Record the exact time the hotkey was pressed
            const hotkeyPressTime = Date.now();
            logger.debug(`Hotkey press time: ${new Date(hotkeyPressTime).toISOString()}`);
            
            // Generate a timestamp for the clip
            const timestamp = new Date().toISOString()
                .replace(/[:.]/g, '-')
                .replace('T', '_')
                .replace('Z', '');
            logger.debug(`Generated timestamp for clip: ${timestamp}`);
            
            // Get settings from the closure
            const settings = getSettingsFunction();
            const clipLength = settings.recordingLength || 20;
            logger.debug(`Using clip length: ${clipLength} seconds`);
            
            // Create the clip settings
            const clipSettings = {
                clipLength: clipLength
            };
            
            // Create the clip with the hotkeyPressTime
            try {
                logger.debug('Calling createClip function with timestamp, settings, and hotkey time', { 
                    timestamp, 
                    clipLength,
                    hotkeyPressTime
                });
                const result = await createClip(timestamp, clipSettings, hotkeyPressTime);
                if (result.success) {
                    logger.info(`Clip created successfully: ${result.filename}`, {
                        path: result.path,
                        timestamp: timestamp
                    });
                    
                    // Notify all browser windows about the new clip
                    const windows = BrowserWindow.getAllWindows();
                    windows.forEach(window => {
                        if (!window.isDestroyed()) {
                            // Send new-recording event
                            window.webContents.send('new-recording', {
                                id: path.parse(result.filename).name,
                                filename: result.filename,
                                timestamp: new Date()
                            });
                            
                            // Send clip-done event
                            window.webContents.send('clip-done', result.filename);
                        }
                    });
                } else {
                    logger.error(`Failed to create clip: ${result.error}`, {
                        timestamp: timestamp,
                        settings: clipSettings
                    });
                    
                    const windows = BrowserWindow.getAllWindows();
                    windows.forEach(window => {
                        if (!window.isDestroyed()) {
                            // Send clip-error event
                            window.webContents.send('clip-error', {
                                error: result.error || 'Unknown error',
                                timestamp: new Date()
                            });
                        }
                    });
                }
            } catch (error) {
                logger.error('Exception during hotkey clip creation:', error);
                
                const windows = BrowserWindow.getAllWindows();
                windows.forEach(window => {
                    if (!window.isDestroyed()) {
                        // Send clip-error event for exceptions too
                        window.webContents.send('clip-error', {
                            error: error.message || 'Exception during clip creation',
                            timestamp: new Date()
                        });
                    }
                });
            }
        });
        
        if (!success) {
            logger.error(`Failed to register hotkey: ${hotkey}`);
            return false;
        }
        
        logger.info(`Hotkey registered successfully: ${hotkey}`);
        return true;
    } catch (error) {
        logger.error(`Error registering hotkey ${hotkey}:`, error);
        return false;
    }
}

// Unregister all hotkeys
export function unregisterHotkeys() {
    logger.debug('Unregistering hotkeys...');
    if (registeredHotkey) {
        try {
            globalShortcut.unregister(registeredHotkey);
            logger.info(`Unregistered hotkey: ${registeredHotkey}`);
        } catch (error) {
            logger.error(`Error unregistering hotkey ${registeredHotkey}:`, error);
        }
        registeredHotkey = null;
    } else {
        logger.debug('No hotkey was registered to unregister');
    }
}

// Function to get settings, will be set later
let getSettingsFunction = () => ({}); 

// Setup hotkey handlers
export function setupHotkeyHandler(hotkey, getSettingsFn) {
    // Set up the callback in the settings handler to avoid circular dependencies
    setupHotkeyCallback(registerHotkey);
    
    // Store the settings getter function
    if (getSettingsFn) {
        getSettingsFunction = getSettingsFn;
    }
    
    // Register the initial hotkey
    logger.debug(`Registering default hotkey: ${hotkey}`);
    const hotkeyResult = registerHotkey(hotkey);
    logger.debug(`Hotkey registration result: ${hotkeyResult ? 'success' : 'failed'}`);
    
    return hotkeyResult;
}