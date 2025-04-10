import { getModuleLogger } from './logger';
import { ensureDirectories } from './ipcDirHandlers';
import { setupSettingsHandlers, getCachedSettings } from './ipcSettingsHandlers';
import { setupHotkeyHandler, unregisterHotkeys } from './ipcHotkeyHandlers';
import { setupRecordingHandlers } from './ipcRecordingHandlers';
import { setupVideoHandlers } from './ipcVideoHandlers';
import { setupSystemHandlers } from './ipcSystemHandlers';

const logger = getModuleLogger('ipcHandlers.js');

// Set up all IPC handlers
export function setupIpcHandlers() {
    logger.info('Setting up IPC handlers...');
    
    // Ensure directories exist when IPC handlers are set up
    try {
        ensureDirectories();
    } catch (error) {
        logger.error('Failed to ensure directories during IPC setup:', error);
    }

    // Initialize settings and setup settings handlers
    setupSettingsHandlers();

    // Register the default hotkey on startup
    const settings = getCachedSettings();
    logger.debug(`Registering default hotkey: ${settings.hotkey}`);
    setupHotkeyHandler(settings.hotkey, getCachedSettings);

    // Set up system-related handlers (screen dimensions, monitors)
    setupSystemHandlers();

    // Set up recording-related handlers
    setupRecordingHandlers();

    // Set up video-related handlers (metadata, editing, listing, deletion)
    setupVideoHandlers();

    logger.info('IPC handlers setup complete');
}

// Clean up all IPC handlers
export function cleanupIpcHandlers() {
    logger.info('Cleaning up IPC handlers...');
    unregisterHotkeys();
    logger.debug('IPC handlers cleanup complete');
}