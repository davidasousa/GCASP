import { ipcMain, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { runRecord } from './recorder';
import { promisify } from 'util';
import { spawn } from 'child_process';
import { getTimestamp } from './utilities';

const exec = promisify(require('child_process').exec);
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
					// File might not exist yet
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
		const filePath = path.join(userVideosPath, filename);
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
			console.log(`Deleted: ${filePath}`);
			return { success: true };
		}
		return { success: false, error: 'File not found' };
	});

	// Get video metadata
	ipcMain.handle('get-video-metadata', async (event, filename) => {
		try {
			const filePath = path.join(userVideosPath, filename);
			
			if (!fs.existsSync(filePath)) {
				return { success: false, error: 'File not found' };
			}

			// Use ffprobe to get video metadata
			const { stdout } = await exec(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration,codec_name,r_frame_rate -show_entries format=duration,size -of json "${filePath}"`);
			
			const metadata = JSON.parse(stdout);
			const videoStream = metadata.streams[0] || {};
			const format = metadata.format || {};
			
			// Calculate frame rate from fraction
			let frameRate = 0;
			if (videoStream.r_frame_rate) {
				const [numerator, denominator] = videoStream.r_frame_rate.split('/');
				frameRate = Math.round(parseInt(numerator) / parseInt(denominator));
			}
			
			return {
				success: true,
				width: videoStream.width,
				height: videoStream.height,
				codec: videoStream.codec_name,
				frameRate,
				duration: parseFloat(format.duration || videoStream.duration || 0),
				size: parseInt(format.size || 0),
				format: 'mp4'
			};
		} catch (error) {
			console.error('Error getting video metadata:', error);
			return { success: false, error: error.message };
		}
	});

	// Save edited video
	ipcMain.handle('save-edited-video', async (event, params) => {
		const {
			originalFilename,
			newTitle,
			startTime,
			endTime,
			compressSizeMB
		} = params;

		try {
			const originalPath = path.join(userVideosPath, originalFilename);
			
			if (!fs.existsSync(originalPath)) {
				return { success: false, error: 'Original file not found' };
			}

			// Determine if we're overwriting or creating a new file
			let outputFilename;
			const shouldOverwrite = newTitle.trim() === originalFilename;
			
			if (shouldOverwrite) {
				// We'll use a temporary file first to avoid data loss
				outputFilename = `temp_edit_${Date.now()}.mp4`;
			} else {
				// New filename based on the provided title
				outputFilename = newTitle.trim().endsWith('.mp4') ? newTitle.trim() : `${newTitle.trim()}.mp4`;
			}
			
			const outputPath = path.join(userVideosPath, outputFilename);

			// Calculate bitrate for target size (in bits per second)
			// Formula: (target_size_bytes * 8) / duration_seconds
			const duration = endTime - startTime;
			const targetSizeBytes = compressSizeMB * 1024 * 1024; // Convert MB to bytes
			const targetBitrate = Math.floor((targetSizeBytes * 8) / duration);

			// Trim and compress the video using ffmpeg
			const ffmpegResult = await new Promise((resolve, reject) => {
				const ffmpegArgs = [
					'-y', // Overwrite output file if exists
					'-i', originalPath, // Input file
					'-ss', startTime.toString(), // Start time
					'-to', endTime.toString(), // End time
					'-c:v', 'libx264', // Video codec
					'-b:v', `${targetBitrate}`, // Video bitrate
					'-preset', 'medium', // Encoding preset (fast, medium, slow, etc.)
					'-c:a', 'aac', // Audio codec
					'-b:a', '128k', // Audio bitrate
					outputPath // Output file
				];

				const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
				
				let stdoutData = '';
				let stderrData = '';
				
				ffmpegProcess.stdout.on('data', (data) => {
					stdoutData += data.toString();
				});
				
				ffmpegProcess.stderr.on('data', (data) => {
					stderrData += data.toString();
				});
				
				ffmpegProcess.on('close', (code) => {
					if (code === 0) {
						resolve({ 
							success: true, 
							filename: outputFilename,
							path: outputPath
						});
					} else {
						console.error('FFmpeg error output:', stderrData);
						reject(new Error(`FFmpeg exited with code ${code}: ${stderrData}`));
					}
				});
				
				ffmpegProcess.on('error', (error) => {
					reject(error);
				});
			});

			// If we're overwriting the original, replace it now
			if (shouldOverwrite) {
				try {
					// Delete original and rename the temp file
					fs.unlinkSync(originalPath);
					fs.renameSync(outputPath, originalPath);
					
					return {
						success: true,
						filename: originalFilename,
						path: originalPath
					};
				} catch (err) {
					console.error('Error replacing original file:', err);
					return {
						success: true,
						filename: outputFilename,
						path: outputPath,
						warning: 'Could not replace original file, saved as new file instead'
					};
				}
			}

			return ffmpegResult;
		} catch (error) {
			console.error('Error saving edited video:', error);
			return { success: false, error: error.message };
		}
	});
}
