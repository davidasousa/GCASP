import { ipcMain, app, globalShortcut } from 'electron';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { spawn } from 'child_process';
import { createClip, startContinuousRecording, stopContinuousRecording } from './recorder';
import { loadSettings, saveSettings, initSettings } from './settings';
import { safelyDeleteRecordings } from './main';

const exec = promisify(require('child_process').exec);

// Set up paths for recordings and clips
const recordingsPath = path.join(app.getPath('videos'), 'GCASP/recordings');
const clipsPath = path.join(app.getPath('videos'), 'GCASP/clips');

// Ensure directories exist
const ensureDirectories = () => {
	if (!fs.existsSync(recordingsPath)) {
		fs.mkdirSync(recordingsPath, { recursive: true });
	}
	if (!fs.existsSync(clipsPath)) {
		fs.mkdirSync(clipsPath, { recursive: true });
	}
};

// Variable to store the registered hotkey
let registeredHotkey = null;

// Register the hotkey for recording clips
function registerHotkey(hotkey) {
    // First unregister any existing hotkeys
    unregisterHotkeys();
    
    // Now register the new hotkey
    try {
        registeredHotkey = hotkey;
        const success = globalShortcut.register(hotkey, async () => {
            console.log(`Hotkey ${hotkey} pressed - creating clip`);
            
            // Generate a timestamp for the clip
            const timestamp = new Date().toISOString()
                .replace(/[:.]/g, '-')
                .replace('T', '_')
                .replace('Z', '');
            
            // Load current settings to get clip length
            const settings = loadSettings();
            
            // Create the clip settings
            const clipSettings = {
                clipLength: settings.recordingLength || 20
            };
            
            // Create the clip
            try {
                const result = await createClip(timestamp, clipSettings);
                if (result.success) {
                    console.log(`Clip created: ${result.filename}`);
                    // Could notify the renderer process here if needed
                } else {
                    console.error(`Failed to create clip: ${result.error}`);
                }
            } catch (error) {
                console.error('Error during hotkey clip creation:', error);
            }
        });
        
        if (!success) {
            console.error(`Failed to register hotkey: ${hotkey}`);
            return false;
        }
        
        console.log(`Registered hotkey: ${hotkey}`);
        return true;
    } catch (error) {
        console.error(`Error registering hotkey ${hotkey}:`, error);
        return false;
    }
}

// Unregister all hotkeys
function unregisterHotkeys() {
    if (registeredHotkey) {
        try {
            globalShortcut.unregister(registeredHotkey);
            console.log(`Unregistered hotkey: ${registeredHotkey}`);
        } catch (error) {
            console.error(`Error unregistering hotkey ${registeredHotkey}:`, error);
        }
        registeredHotkey = null;
    }
    // Alternatively, you could use:
    // globalShortcut.unregisterAll();
}

export function setupIpcHandlers() {
	// Ensure directories exist when IPC handlers are set up
	ensureDirectories();

	// Initialize settings
	const settings = initSettings();

	// Register the default hotkey on startup
	registerHotkey(settings.hotkey);

	// Start the continuous recording when IPC handlers are set up
	startContinuousRecording();

	// Get settings
	ipcMain.handle('get-settings', () => {
		return loadSettings();
	});

	// Save settings
	ipcMain.handle('save-settings', (event, newSettings) => {
		const success = saveSettings(newSettings);
		
		// If hotkey was changed, update the registered hotkey
		if (success && newSettings.hotkey && newSettings.hotkey !== registeredHotkey) {
			registerHotkey(newSettings.hotkey);
		}
		
		return { success };
	});

	// Get list of local clips
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

	// Remove all local clips
	ipcMain.handle('remove-local-clips', () => {
		const files = fs.readdirSync(clipsPath);
		files.filter(file => file.endsWith('.mp4'))
			.forEach(file => {
				const filePath = path.join(clipsPath, file);
				try {
					fs.unlinkSync(filePath);  // Remove the file
					console.log(`Deleted: ${filePath}`);
				} catch (err) {
					console.error(`Failed to delete ${filePath}:`, err);
				}
			});
		return { success: true };
	});

	// Trigger recording (for splicing implementation)
	ipcMain.handle('trigger-record', async (event) => {
		const timestamp = new Date().toISOString()
			.replace(/[:.]/g, '-')
			.replace('T', '_')
			.replace('Z', '');
		
		try {
			// This will be handled by the continuous recording in recorder.js
			// Just return the latest segment info
			const segments = fs.readdirSync(recordingsPath)
				.filter(file => file.endsWith('.mp4'))
				.map(file => {
					const filePath = path.join(recordingsPath, file);
					const stats = fs.statSync(filePath);
					return {
						filename: file,
						path: filePath,
						timestamp: stats.mtime
					};
				})
				.sort((a, b) => b.timestamp - a.timestamp);
			
			if (segments.length > 0) {
				const latest = segments[0];
				return {
					id: path.parse(latest.filename).name,
					filename: latest.filename,
					timestamp: latest.timestamp
				};
			}
			
			// If no segments found, return a placeholder
			return {
				id: `placeholder_${timestamp}`,
				filename: `placeholder_${timestamp}.mp4`,
				timestamp: new Date()
			};
		} catch (error) {
			console.error('Recording error:', error);
			throw error;
		}
	});

	// Trigger clip creation with splicing
	ipcMain.handle('trigger-clip', async (event, clipTimestamp, clipSettings) => {
		try {
			// Use the same settings format for both implementations
			const settings = clipSettings || { clipLength: 14 };
			
			// Create the clip
			const result = await createClip(clipTimestamp, settings);
			
			if (result.success) {
				// Extract the ID from the filename (without extension)
				const id = path.parse(result.filename).name;
				
				// Notify about new clip
				event.sender.send('new-recording', {
					id: id,
					filename: result.filename,
					timestamp: new Date()
				});
				
				// Notify frontend that clip is done
				event.sender.send('clip-done', result.filename);
				
				return {
					success: true,
					filename: result.filename,
					path: result.path
				};
			} else {
				return { success: false, error: result.error };
			}
		} catch (error) {
			console.error('Error creating clip:', error);
			return { success: false, error: error.message };
		}
	});

	// Delete a specific video 
	ipcMain.handle('remove-specific-video', (event, filename) => {
		// Try to find in recordings path first
		let filePath = path.join(recordingsPath, filename);
		if (fs.existsSync(filePath)) {
			try {
				fs.unlinkSync(filePath);
				console.log(`Deleted recording: ${filePath}`);
				return { success: true };
			} catch (err) {
				console.error(`Error deleting recording: ${filePath}`, err);
			}
		}
		
		// If not found, try clips path
		filePath = path.join(clipsPath, filename);
		if (fs.existsSync(filePath)) {
			try {
				fs.unlinkSync(filePath);
				console.log(`Deleted clip: ${filePath}`);
				return { success: true };
			} catch (err) {
				console.error(`Error deleting clip: ${filePath}`, err);
				return { success: false, error: err.message };
			}
		}
		
		return { success: false, error: 'File not found' };
	});

	// Get video metadata (for clips)
	ipcMain.handle('get-video-metadata', async (event, filename) => {
		try {
			const filePath = path.join(clipsPath, filename);
			
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
			const originalPath = path.join(clipsPath, originalFilename);
			
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
				const newPath = path.join(clipsPath, newFileName);
				
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
			
			const outputPath = path.join(clipsPath, outputFilename);
			
			// Check if target filename already exists
			if (fs.existsSync(outputPath) && outputPath !== originalPath) {
				return { 
					success: false, 
					error: `A file named "${outputFilename}" already exists. Please choose a different name.`
				};
			}
			
			const finalOutputPath = path.join(clipsPath, outputFilename);

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

			// Get the FFmpeg path with fallback
			const ffmpegPath = process.env.FFMPEG_EXECUTABLE_PATH || 'ffmpeg';
			const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
			
			const ffmpegResult = await new Promise((resolve, reject) => {
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

	// Flushing & Restarting The Recorder
	ipcMain.handle('flush-restart-recorder', () => {
		safelyDeleteRecordings();
		stopContinuousRecording();
		setTimeout(() => {}, 500);
		startContinuousRecording();
	});
}

// Make sure to unregister shortcuts when the app is about to quit
export function cleanupIpcHandlers() {
    unregisterHotkeys();
}

