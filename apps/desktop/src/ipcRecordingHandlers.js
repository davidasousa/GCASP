import { ipcMain, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { startContinuousRecording, stopContinuousRecording, createClip } from './recorder';
import { getModuleLogger } from './logger';
import { recordingsPath, clipsPath } from './ipcDirHandlers';
import { getCachedSettings } from './ipcSettingsHandlers';

const logger = getModuleLogger('ipcRecordingHandlers.js');

export function setupRecordingHandlers() {
    // Trigger recording (for splicing implementation)
    logger.debug('Registering trigger-record handler');
    ipcMain.handle('trigger-record', async (event) => {
        logger.debug('trigger-record handler called');
        const timestamp = new Date().toISOString()
            .replace(/[:.]/g, '-')
            .replace('T', '_')
            .replace('Z', '');
        
        logger.debug(`Generated timestamp for recording: ${timestamp}`);
        
        try {
            // Check if directory exists
            if (!fs.existsSync(recordingsPath)) {
                logger.warn(`Recordings directory does not exist: ${recordingsPath}`);
                return {
                    id: `placeholder_${timestamp}`,
                    filename: `placeholder_${timestamp}.mp4`,
                    timestamp: new Date()
                };
            }

            // This will be handled by the continuous recording in recorder.js
            // Just return the latest segment info
            logger.debug('Reading recording segments directory...');
            const files = fs.readdirSync(recordingsPath);
            const videoFiles = files.filter(file => file.endsWith('.mp4'));
            logger.debug(`Found ${videoFiles.length} .mp4 recording segments`);
            
            if (videoFiles.length === 0) {
                logger.warn('No recording segments found');
                return {
                    id: `placeholder_${timestamp}`,
                    filename: `placeholder_${timestamp}.mp4`,
                    timestamp: new Date()
                };
            }
            
            const segments = videoFiles.map(file => {
                const filePath = path.join(recordingsPath, file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    path: filePath,
                    timestamp: stats.mtime
                };
            })
            .sort((a, b) => b.timestamp - a.timestamp);
            
            logger.debug(`Sorted ${segments.length} segments by timestamp`);
            
            if (segments.length > 0) {
                const latest = segments[0];
                logger.info(`Found latest segment: ${latest.filename}`);
                return {
                    id: path.parse(latest.filename).name,
                    filename: latest.filename,
                    timestamp: latest.timestamp
                };
            }
            
            // If no segments found, return a placeholder
            logger.warn('No segments found after sorting (unexpected)');
            return {
                id: `placeholder_${timestamp}`,
                filename: `placeholder_${timestamp}.mp4`,
                timestamp: new Date()
            };
        } catch (error) {
            logger.error('Recording trigger error:', error);
            throw error;
        }
    });

    // Trigger clip creation with splicing
    logger.debug('Registering trigger-clip handler');
    ipcMain.handle('trigger-clip', async (event, clipTimestamp, clipSettings) => {
        logger.info('trigger-clip handler called', { clipTimestamp, clipSettings });
        try {
            // Use cached settings if no clip settings provided
            const settings = clipSettings || { 
                clipLength: getCachedSettings().recordingLength || 20 
            };
            
            logger.debug('Clip settings', settings);
            
            // Create the clip
            logger.debug('Calling createClip function...');
            const result = await createClip(clipTimestamp, settings);
            
            if (result.success) {
                // Extract the ID from the filename (without extension)
                const id = path.parse(result.filename).name;
                logger.info(`Clip created successfully: ${result.filename}`, {
                    id,
                    path: result.path
                });
                
                // Notify about new clip
                logger.debug('Sending new-recording event to renderer process');
                event.sender.send('new-recording', {
                    id: id,
                    filename: result.filename,
                    timestamp: new Date()
                });
                
                // Notify frontend that clip is done
                logger.debug('Sending clip-done event to renderer process');
                event.sender.send('clip-done', result.filename);
                
                return {
                    success: true,
                    filename: result.filename,
                    path: result.path
                };
            } else {
                logger.error(`Failed to create clip: ${result.error}`);
                return { success: false, error: result.error };
            }
        } catch (error) {
            logger.error('Error creating clip:', error);
            return { success: false, error: error.message };
        }
    });

    // Add explicit recording start handler
    ipcMain.handle('start-recording', () => {
        logger.info('start-recording handler called');
        try {
            startContinuousRecording();
            logger.info('Continuous recording started via IPC');
            return { success: true };
        } catch (error) {
            logger.error('Error starting recording:', error);
            return { success: false, error: error.message };
        }
    });

    // Add explicit recording stop handler
    ipcMain.handle('stop-recording', () => {
        logger.info('stop-recording handler called');
        try {
            stopContinuousRecording();
            logger.info('Continuous recording stopped via IPC');
            return { success: true };
        } catch (error) {
            logger.error('Error stopping recording:', error);
            return { success: false, error: error.message };
        }
    });
}