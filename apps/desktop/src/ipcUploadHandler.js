import { ipcMain } from 'electron';
import { getModuleLogger } from './logger';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

const logger = getModuleLogger('ipcSettingsHandlers.js');

// Taken From videoProtocal.js
const findClip = (videoTitle) => {
    const clipsPath = path.join(app.getPath('videos'), 'GCASP/clips');
    const clipFiles = fs.readdirSync(clipsPath);
    const match = clipFiles.find(file => file === videoTitle);

    if (match) {
        return path.join(clipsPath, match); // full path
    } else {
        return null;
    }
};

// Initialize settings and register handlers
export function setupUploadHandlers() {
    logger.debug("Setting Up Upload Handlers");
        // Trigger Upload Clip
        logger.debug("Registering Upload");
        ipcMain.handle('trigger-upload-clip', async (event, title, token) => {
            logger.debug('Uploading Clip');
            const clip = findClip(title);
            console.log(clip);
        });
}

export default setupUploadHandlers;