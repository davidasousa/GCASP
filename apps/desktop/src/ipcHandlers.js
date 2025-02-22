import { ipcMain, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { runRecord } from './recorder';
import { clipSettings } from './clipper.js';

const recordingsPath = path.join(app.getPath('videos'), 'GCASP/recordings');
const clipsPath = path.join(app.getPath('videos'), 'GCASP/clips');

export function setupIpcHandlers() {

// Get list of local videos
ipcMain.handle('get-local-videos', () => {
    const files = fs.readdirSync(clipsPath);
    return files
    .filter(file => file.endsWith('.mp4'))
    .map(file => {
        const filePath = path.join(clipsPath, file);
				console.log(filePath);
        const stats = fs.statSync(filePath);
        return {
        id: path.parse(file).name,
        filename: file,
        timestamp: stats.mtime
        };
    });
});

// Remove Local Recordings
ipcMain.handle('remove-local-clips', () => {
		console.log("removing");
		const files = fs.readdirSync(clipsPath);
		files.filter(file => file.endsWith('.mp4'))
		.map(file => {
				const filePath = path.join(clipsPath, file);
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
            event.sender.send('recording-done', videoInfo);
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

// Delete a specific video
ipcMain.handle('remove-specific-video', (event, filename) => {
    const filePath = path.join(recordingsPath, filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted: ${filePath}`);
        return { success: true };
    }
    return { success: false, error: 'File not found' };
});

ipcMain.handle('trigger-clip', async (event, clipSettings) => {
	var videoFiles = [];
	const files = fs.readdirSync(recordingsPath);
	files.filter(file => file.endsWith('.mp4'))
	.map(file => {
			console.log(`${file}`);
			videoFiles.push(file);
	});  

	const mostRecentVideo = videoFiles[videoFiles.length - 1];

	const recordingPath = path.join(recordingsPath, mostRecentVideo);
	const clipPath = path.join(clipsPath, mostRecentVideo);

	await fs.copyFile(
		recordingPath,
		clipPath,
		(err) => {
			console.log(err);
		}
	);

	// Notify Frontend Clip Is Done
	// event.sender.send('clip-done', clipName);
});

}
