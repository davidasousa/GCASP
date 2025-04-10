import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { getModuleLogger } from './logger';

const logger = getModuleLogger('ipcDirHandlers.js');

// Set up paths for recordings and clips
export const recordingsPath = path.join(app.getPath('videos'), 'GCASP/recordings');
export const clipsPath = path.join(app.getPath('videos'), 'GCASP/clips');

// Ensure directories exist
export const ensureDirectories = () => {
    logger.debug('Ensuring recording and clip directories exist...');
    try {
        if (!fs.existsSync(recordingsPath)) {
            logger.info(`Creating recordings directory: ${recordingsPath}`);
            fs.mkdirSync(recordingsPath, { recursive: true });
            logger.debug('Recordings directory created successfully');
        }
        if (!fs.existsSync(clipsPath)) {
            logger.info(`Creating clips directory: ${clipsPath}`);
            fs.mkdirSync(clipsPath, { recursive: true });
            logger.debug('Clips directory created successfully');
        }
        logger.debug('Directory check completed successfully');
    } catch (error) {
        logger.error('Failed to create directories:', error);
        throw error; // Rethrow as this is critical
    }
};