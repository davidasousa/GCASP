import { ipcMain, app } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';
import { runRecord } from './recorder';

const recordingsPath = path.join(app.getPath('videos'), 'GCASP/recordings');
const recordingLength = 5; // Recording Length In Seconds

const clipsPath = path.join(app.getPath('videos'), 'GCASP/clips');
const clipInstructionsPath = path.join(app.getPath('videos'), 'GCASP/clipInstructions.txt');

export function setupIpcHandlers() {

// Get list of local videos
ipcMain.handle('get-local-videos', () => {
    const files = fs.readdirSync(clipsPath);
    return files
    .filter(file => file.endsWith('.mp4'))
    .map(file => {
        const filePath = path.join(clipsPath, file);
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
//            event.sender.send('recording-done', videoInfo);
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

ipcMain.handle('trigger-clip', async (event, clipTimestamp, clipSettings) => {
	const timestampPattern = /clip_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3})\.mp4$/;

	const rawOutputPath = path.join(clipsPath, `clip_${clipTimestamp}_raw.mp4`);
	const outputPath = path.join(clipsPath, `clip_${clipTimestamp}.mp4`);

	// Sorting Recordings
	const sortedVideos = fs.readdirSync(recordingsPath)
  .filter(file => file.endsWith('.mp4'))
  .map(file => {
    const timestampMatch = file.match(timestampPattern);
    const timestamp = timestampMatch ? timestampMatch[1] : null;
    return { file, timestamp };
  })
  .sort((a, b) => {
    const dateA = new Date(a.timestamp.replace(/_/g, ':').replace('-', '/'));
    const dateB = new Date(b.timestamp.replace(/_/g, ':').replace('-', '/'));
    return dateB - dateA;
  })
  .map(entry => entry.file);

	// Getting Enough Videos To Get The Clip
	const clipRecordings = sortedVideos.slice(
		sortedVideos.length - Math.ceil(clipSettings.clipLength / recordingLength),
		sortedVideos.length)

	// Amount Needed To Cut To Match Video Length
	const ssCut = (clipRecordings.length * recordingLength - clipSettings.clipLength).toString();
	
	// Writing Videos To Text File
	fs.writeFileSync(clipInstructionsPath, '', { flag: 'w' });
	clipRecordings.forEach(str => {
		const path = 'file \'' + recordingsPath + '/' + str + '\'';
		fs.appendFileSync(clipInstructionsPath, path + '\n');
	});

	const concatArgs = [
		'-f',
		'concat',
		'-safe', '0', 
		'-i', clipInstructionsPath,
		'-c', 'copy',
		rawOutputPath
	];

	const shaveArgs = [
		'-ss',
		ssCut,
		'-i', rawOutputPath,
		'-c', 'copy',
		outputPath
	];

	function runFfmpegProcess(args) {
		return new Promise((resolve, reject) => {
			const ffmpegProcess = spawn(process.env.FFMPEG_EXECUTABLE_NAME, args);

			ffmpegProcess.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`FFmpeg process exited with code ${code}`));
				}
			});

			ffmpegProcess.on('error', (err) => {
				reject(err);
			});
		});
	}

	// Main function to handle the entire process
	async function processVideo() {
		try {
			await runFfmpegProcess(concatArgs);
			console.log("Raw Concat Done");

			await runFfmpegProcess(shaveArgs);
			console.log("Clipping Done");

			await fs.unlink(rawOutputPath, (err) => {
				console.log(err);
			});
			console.log('File Deleted Successfully');
		} catch (err) {
			console.error('Error during processing:', err);
		}
	}

	// Execute the main function
	processVideo();
	
	return;
});

}
