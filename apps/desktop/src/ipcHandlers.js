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
			compressSizeMB,
			enableCompression
		} = params;

		try {
			const originalPath = path.join(userVideosPath, originalFilename);
			
			if (!fs.existsSync(originalPath)) {
				return { success: false, error: 'Original file not found' };
			}

			// Get the original metadata to determine if content is being modified
			const { stdout } = await exec(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration,codec_name,r_frame_rate -show_entries format=duration,size -of json "${originalPath}"`);
			const metadata = JSON.parse(stdout);
			const originalDuration = parseFloat(metadata.format.duration || 0);
			const originalSizeBytes = parseInt(metadata.format.size || 0);
			const originalSizeMB = originalSizeBytes / (1024 * 1024);
			
			// Determine if we're modifying content (trimming or compression)
			const isTrimming = Math.abs(startTime) > 0.1 || Math.abs(endTime - originalDuration) > 0.1;
			
			// Only consider compression if it's enabled AND target size is smaller than current size
			const isCompressionEffective = enableCompression && compressSizeMB < originalSizeMB;
			const isContentModified = isTrimming || isCompressionEffective;
			const isTitleChanged = newTitle.trim() !== originalFilename;
			
			// Case 0: No changes at all - do nothing
			if (!isContentModified && !isTitleChanged) {
				return {
					success: true,
					filename: originalFilename,
					path: originalPath,
					message: 'No changes were needed'
				};
			}
			
			// Case 1: Title-only change (no content modification)
			if (isTitleChanged && !isContentModified) {
				const newFileName = newTitle.trim().endsWith('.mp4') ? newTitle.trim() : `${newTitle.trim()}.mp4`;
				const newPath = path.join(userVideosPath, newFileName);
				
				// Check if target filename already exists
				if (fs.existsSync(newPath) && newPath !== originalPath) {
					return { 
						success: false, 
						error: `A file named "${newFileName}" already exists. Please choose a different name.`
					};
				}
				
				try {
					// Simply rename the file
					fs.renameSync(originalPath, newPath);
					return {
						success: true,
						filename: newFileName,
						path: newPath,
						message: 'File renamed successfully'
					};
				} catch (err) {
					console.error('Error renaming file:', err);
					return { success: false, error: `Error renaming file: ${err.message}` };
				}
			}
			
			// Case 2: Content modification
			// Determine output filename
			let outputFilename;
			if (!isTitleChanged) {
				// Same title but content modified - add _edit suffix
				const baseName = path.basename(originalFilename, '.mp4');
				outputFilename = `${baseName}_edit.mp4`;
			} else {
				// New title and content modified
				outputFilename = newTitle.trim().endsWith('.mp4') ? newTitle.trim() : `${newTitle.trim()}.mp4`;
			}
			
			const outputPath = path.join(userVideosPath, outputFilename);
			
			// Check if target filename already exists
			if (fs.existsSync(outputPath)) {
				return { 
					success: false, 
					error: `A file named "${outputFilename}" already exists. Please choose a different name.`
				};
			}
			
			const finalOutputPath = path.join(userVideosPath, outputFilename);

			// Calculate bitrate for target size if compression is enabled and effective
			let targetBitrate;
			const duration = endTime - startTime;
			
			if (isCompressionEffective) {
				const targetSizeBytes = compressSizeMB * 1024 * 1024; // Convert MB to bytes
				targetBitrate = Math.floor((targetSizeBytes * 8) / duration);
			} else {
				// Use a high bitrate to maintain quality if not compressing
				targetBitrate = "5000k";
			}

			// Trim and optionally compress the video using ffmpeg
			const ffmpegArgs = [
				'-y', // Overwrite output file if exists
				'-i', originalPath, // Input file
				'-ss', startTime.toString(), // Start time
				'-to', endTime.toString(), // End time
				'-c:v', 'libx264', // Video codec
				'-b:v', `${targetBitrate}`, // Video bitrate
				'-preset', 'medium', // Encoding preset
				'-c:a', 'aac', // Audio codec
				'-b:a', '128k', // Audio bitrate
				finalOutputPath // Output file
			];

			const ffmpegResult = await new Promise((resolve, reject) => {
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
							path: finalOutputPath
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

			return {
				...ffmpegResult,
				message: isTrimming ? 
					'Video trimmed and saved successfully' : 
					isCompressionEffective ? 
						'Video compressed and saved successfully' : 
						'Video processed and saved successfully'
			};
		} catch (error) {
			console.error('Error saving edited video:', error);
			return { success: false, error: error.message };
		}
	});
}
