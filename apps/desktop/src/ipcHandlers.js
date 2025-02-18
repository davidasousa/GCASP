import { ipcMain, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { runRecord } from './recorder';

const userVideosPath = path.join(app.getPath('videos'), 'GCASP');

export function setupIpcHandlers() {
// Get list of local videos
ipcMain.handle('get-local-videos', () => {
    const files = fs.readdirSync(userVideosPath);
    return files
    .filter(file => file.endsWith('.mp4'))
    .map(file => {
        const filePath = path.join(userVideosPath, file);
        const stats = fs.statSync(filePath);
        return {
        id: path.parse(file).name,
        filename: file,
        timestamp: stats.mtime
        };
    });
});

// Remove Local Videos
ipcMain.handle('remove-local-videos', () => {
    const files = fs.readdirSync(userVideosPath);
    files.filter(file => file.endsWith('.mp4'))
    .map(file => {
        const filePath = path.join(userVideosPath, file);
				fs.unlinkSync(filePath);  // Remove the file
				console.log(`Deleted: ${filePath}`);
    });
});

// Trigger video recording
ipcMain.handle('trigger-record', async (event) => {
    const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .replace('Z', '');
    
    // Don't send the event until recording is complete
    try {
    const outputPath = await runRecord(timestamp);
    
    // Check if file exists and is complete
    const maxAttempts = 10;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        try {
        const stats = fs.statSync(outputPath);
        if (stats.size > 0) {
            const videoInfo = {
            id: timestamp,
            filename: path.basename(outputPath),
            timestamp: new Date()
            };
            
            // Only notify about new recording after file is confirmed ready
            event.sender.send('new-recording', videoInfo);
            return videoInfo;
        }
        } catch (err) {
					console.log(err);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
    }
    
    throw new Error('Recording failed to complete');
    } catch (error) {
    console.error('Recording error:', error);
    throw error;
    }
});
}
