import { ipcMain } from 'electron';
import { getModuleLogger } from './logger';

const logger = getModuleLogger('ipcSettingsHandlers.js');

// Initialize settings and register handlers
export function setupUploadHandlers() {
    logger.debug("Setting Up Upload Handlers");
        // Trigger Upload Clip
        logger.debug("Registering Upload");
        ipcMain.handle('trigger-upload-clip', async (event, title, token) => {
            logger.debug('Uploading Clip');
            console.log(token, title);
        });
}

export default setupUploadHandlers;