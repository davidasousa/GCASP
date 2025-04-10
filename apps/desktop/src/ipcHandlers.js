import { ipcMain, app, globalShortcut, screen, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { spawn } from 'child_process';
import { createClip, startContinuousRecording, stopContinuousRecording, restartRecordingWithNewSettings } from './recorder';
import { getCurrentSettings, saveSettings, initSettings, onSettingsChanged } from './settings';
import { getModuleLogger } from './logger';

const logger = getModuleLogger('ipcHandler.js');

const exec = promisify(require('child_process').exec);

// Set up paths for recordings and clips
const recordingsPath = path.join(app.getPath('videos'), 'GCASP/recordings');
const clipsPath = path.join(app.getPath('videos'), 'GCASP/clips');
logger.debug(`IPC Handler initialization - Recordings path: ${recordingsPath}, Clips path: ${clipsPath}`);

// Cache for the current settings
let cachedSettings = null;

// Ensure directories exist
const ensureDirectories = () => {
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

// Variable to store the registered hotkey
let registeredHotkey = null;

function registerHotkey(hotkey) {
	logger.info(`Attempting to register hotkey: ${hotkey}`);
	
	// First unregister any existing hotkeys
	unregisterHotkeys();
	
	// Now register the new hotkey
	try {
		registeredHotkey = hotkey;
		const success = globalShortcut.register(hotkey, async () => {
			logger.info(`Hotkey ${hotkey} pressed - creating clip`);
			
			// Notify all windows immediately that the hotkey was pressed
			const windows = BrowserWindow.getAllWindows();
			windows.forEach(window => {
				if (!window.isDestroyed()) {
					window.webContents.send('hotkey-pressed');
				}
			});
			
			// Record the exact time the hotkey was pressed
			const hotkeyPressTime = Date.now();
			logger.debug(`Hotkey press time: ${new Date(hotkeyPressTime).toISOString()}`);
			
			// Generate a timestamp for the clip
			const timestamp = new Date().toISOString()
				.replace(/[:.]/g, '-')
				.replace('T', '_')
				.replace('Z', '');
			logger.debug(`Generated timestamp for clip: ${timestamp}`);
			
			// Use cached settings instead of loading from disk
			const settings = cachedSettings;
			const clipLength = settings.recordingLength || 20;
			logger.debug(`Using clip length: ${clipLength} seconds`);
			
			// Create the clip settings
			const clipSettings = {
				clipLength: clipLength
			};
			
			// Create the clip with the hotkeyPressTime
			try {
				logger.debug('Calling createClip function with timestamp, settings, and hotkey time', { 
					timestamp, 
					clipLength,
					hotkeyPressTime
				});
				const result = await createClip(timestamp, clipSettings, hotkeyPressTime);
				if (result.success) {
					logger.info(`Clip created successfully: ${result.filename}`, {
						path: result.path,
						timestamp: timestamp
					});
					
					// Notify all browser windows about the new clip
					const windows = BrowserWindow.getAllWindows();
					windows.forEach(window => {
						if (!window.isDestroyed()) {
							// Send new-recording event
							window.webContents.send('new-recording', {
								id: path.parse(result.filename).name,
								filename: result.filename,
								timestamp: new Date()
							});
							
							// Send clip-done event
							window.webContents.send('clip-done', result.filename);
						}
					});
				} else {
					logger.error(`Failed to create clip: ${result.error}`, {
						timestamp: timestamp,
						settings: clipSettings
					});
					
					const windows = BrowserWindow.getAllWindows();
					windows.forEach(window => {
						if (!window.isDestroyed()) {
							// Send clip-error event
							window.webContents.send('clip-error', {
								error: result.error || 'Unknown error',
								timestamp: new Date()
							});
						}
					});
				}
			} catch (error) {
				logger.error('Exception during hotkey clip creation:', error);
				
				const windows = BrowserWindow.getAllWindows();
				windows.forEach(window => {
					if (!window.isDestroyed()) {
						// Send clip-error event for exceptions too
						window.webContents.send('clip-error', {
							error: error.message || 'Exception during clip creation',
							timestamp: new Date()
						});
					}
				});
			}
		});
		
		if (!success) {
			logger.error(`Failed to register hotkey: ${hotkey}`);
			return false;
		}
		
		logger.info(`Hotkey registered successfully: ${hotkey}`);
		return true;
	} catch (error) {
		logger.error(`Error registering hotkey ${hotkey}:`, error);
		return false;
	}
}

// Unregister all hotkeys
function unregisterHotkeys() {
	logger.debug('Unregistering hotkeys...');
	if (registeredHotkey) {
		try {
			globalShortcut.unregister(registeredHotkey);
			logger.info(`Unregistered hotkey: ${registeredHotkey}`);
		} catch (error) {
			logger.error(`Error unregistering hotkey ${registeredHotkey}:`, error);
		}
		registeredHotkey = null;
	} else {
		logger.debug('No hotkey was registered to unregister');
	}
}

// Handle settings changes
function handleSettingsChanged(newSettings) {
	logger.debug('Settings changed, updating application state...');
	
	// Update cached settings
	const oldSettings = cachedSettings;
	cachedSettings = newSettings;
	
	// Check if hotkey changed
	if (oldSettings && oldSettings.hotkey !== newSettings.hotkey) {
		logger.info(`Hotkey changed from ${oldSettings.hotkey} to ${newSettings.hotkey}`);
		registerHotkey(newSettings.hotkey);
	}
	
	// Check if recording settings changed
	const resolutionChanged = 
		oldSettings && 
		(oldSettings.resolution?.width !== newSettings.resolution?.width || 
		oldSettings.resolution?.height !== newSettings.resolution?.height);
	
	const fpsChanged = oldSettings && oldSettings.fps !== newSettings.fps;
	
	const monitorChanged = oldSettings && oldSettings.selectedMonitor !== newSettings.selectedMonitor;
	
	// If resolution, FPS, or selected monitor changed, restart recording with new settings
	if (resolutionChanged || fpsChanged || monitorChanged) {
		logger.info('Recording settings changed, restarting recording...');
		restartRecordingWithNewSettings().catch(error => {
			logger.error('Failed to restart recording with new settings:', error);
		});
	}
}

export function setupIpcHandlers() {
	logger.info('Setting up IPC handlers...');
	
	// Ensure directories exist when IPC handlers are set up
	try {
		ensureDirectories();
	} catch (error) {
		logger.error('Failed to ensure directories during IPC setup:', error);
	}

	// Initialize settings
	logger.debug('Initializing settings...');
	cachedSettings = initSettings();
	logger.debug('Settings initialized', cachedSettings);

	// Register for settings changes
	onSettingsChanged(handleSettingsChanged);

	// Register the default hotkey on startup
	logger.debug(`Registering default hotkey: ${cachedSettings.hotkey}`);
	const hotkeyResult = registerHotkey(cachedSettings.hotkey);
	logger.debug(`Hotkey registration result: ${hotkeyResult ? 'success' : 'failed'}`);

	// REMOVED: Automatic recording start code
	// logger.info('Starting continuous recording...');
	// try {
	//     startContinuousRecording();
	//     logger.info('Continuous recording started');
	// } catch (error) {
	//     logger.error('Failed to start continuous recording:', error);
	// }

	// Get screen dimensions
	logger.debug('Registering get-screen-dimensions handler');
	ipcMain.handle('get-screen-dimensions', () => {
		logger.debug('get-screen-dimensions handler called');
		try {
			const primaryDisplay = screen.getPrimaryDisplay();
			const dimensions = {
				width: primaryDisplay.bounds.width,
				height: primaryDisplay.bounds.height,
				scaleFactor: primaryDisplay.scaleFactor
			};
			logger.debug('Retrieved screen dimensions', dimensions);
			return dimensions;
		} catch (error) {
			logger.error('Error getting screen dimensions:', error);
			throw error;
		}
	});
	
	// Get all monitors
	logger.debug('Registering get-monitors handler');
	ipcMain.handle('get-monitors', async () => {
		logger.debug('get-monitors handler called');
		try {
			// Get all displays from Electron screen API
			const displays = screen.getAllDisplays();
			logger.debug(`Found ${displays.length} displays`);
			
			// Format the displays into a usable format
			const monitors = displays.map((display, index) => {
				const isPrimary = display.id === screen.getPrimaryDisplay().id;
				const monitor = {
					id: index.toString(),
					name: `Monitor ${index + 1}${isPrimary ? ' (Primary)' : ''}`,
					width: display.bounds.width,
					height: display.bounds.height,
					x: display.bounds.x,
					y: display.bounds.y,
					isPrimary
				};
				logger.debug(`Mapped display ${index}`, monitor);
				return monitor;
			});
			
			logger.debug(`Returning ${monitors.length} monitors`);
			return monitors;
		} catch (error) {
			logger.error('Error getting monitors:', error);
			throw error;
		}
	});

	// Get settings
	logger.debug('Registering get-settings handler');
	ipcMain.handle('get-settings', () => {
		logger.debug('get-settings handler called');
		try {
			logger.debug('Returning cached settings');
			return cachedSettings || getCurrentSettings();
		} catch (error) {
			logger.error('Error getting settings:', error);
			throw error;
		}
	});

	// Save settings
	logger.debug('Registering save-settings handler');
	ipcMain.handle('save-settings', async (event, newSettings) => {
		logger.debug('save-settings handler called', { newSettings });
		try {
			// Save the new settings - the saveSettings function will handle updating the cache
			logger.debug('Saving new settings...');
			const success = saveSettings(newSettings);
			logger.info(`Settings save ${success ? 'successful' : 'failed'}`);
			
			return { success };
		} catch (error) {
			logger.error('Error saving settings:', error);
			return { success: false, error: error.message };
		}
	});

	// Get list of local clips
	logger.debug('Registering get-local-videos handler');
	ipcMain.handle('get-local-videos', () => {
		logger.debug('get-local-videos handler called');
		try {
			// Check if directory exists
			if (!fs.existsSync(clipsPath)) {
				logger.warn(`Clips directory does not exist: ${clipsPath}`);
				return [];
			}

			// Read directory
			const files = fs.readdirSync(clipsPath);
			logger.debug(`Found ${files.length} files in clips directory`);
			
			// Filter and process files
			const videoFiles = files.filter(file => file.endsWith('.mp4'));
			logger.debug(`Found ${videoFiles.length} .mp4 files`);
			
			const result = videoFiles.map(file => {
				try {
					const filePath = path.join(clipsPath, file);
					const stats = fs.statSync(filePath);
					return {
						id: path.parse(file).name,
						filename: file,
						timestamp: stats.mtime
					};
				} catch (error) {
					logger.warn(`Error processing file ${file}:`, error);
					return null;
				}
			}).filter(Boolean); // Remove any null entries from failed processing
			
			logger.debug(`Returning ${result.length} video files`);
			return result;
		} catch (error) {
			logger.error('Error getting local videos:', error);
			throw error;
		}
	});

	// Remove all local clips
	logger.debug('Registering remove-local-clips handler');
	ipcMain.handle('remove-local-clips', () => {
		logger.info('remove-local-clips handler called - deleting all clips');
		try {
			// Check if directory exists
			if (!fs.existsSync(clipsPath)) {
				logger.warn(`Clips directory does not exist: ${clipsPath}`);
				return { success: true, message: 'No clips directory to clean' };
			}

			// Read directory
			const files = fs.readdirSync(clipsPath);
			const videoFiles = files.filter(file => file.endsWith('.mp4'));
			logger.info(`Found ${videoFiles.length} .mp4 files to delete`);
			
			// Delete files
			let deleted = 0;
			let failed = 0;
			
			videoFiles.forEach(file => {
				const filePath = path.join(clipsPath, file);
				try {
					fs.unlinkSync(filePath);  // Remove the file
					logger.debug(`Deleted: ${filePath}`);
					deleted++;
				} catch (err) {
					logger.error(`Failed to delete ${filePath}:`, err);
					failed++;
				}
			});
			
			logger.info(`Deleted ${deleted} clips, ${failed} failed`);
			return { 
				success: true,
				deletedCount: deleted,
				failedCount: failed
			};
		} catch (error) {
			logger.error('Error removing local clips:', error);
			return { success: false, error: error.message };
		}
	});

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
				clipLength: cachedSettings.recordingLength || 20 
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

	// Delete a specific video 
	logger.debug('Registering remove-specific-video handler');
	ipcMain.handle('remove-specific-video', (event, filename) => {
		logger.info(`remove-specific-video handler called for file: ${filename}`);
		
		// Try to find in recordings path first
		let filePath = path.join(recordingsPath, filename);
		logger.debug(`Checking in recordings path: ${filePath}`);
		if (fs.existsSync(filePath)) {
			try {
				fs.unlinkSync(filePath);
				logger.info(`Deleted recording: ${filePath}`);
				return { success: true };
			} catch (err) {
				logger.error(`Error deleting recording: ${filePath}`, err);
			}
		} else {
			logger.debug(`File not found in recordings path: ${filePath}`);
		}
		
		// If not found, try clips path
		filePath = path.join(clipsPath, filename);
		logger.debug(`Checking in clips path: ${filePath}`);
		if (fs.existsSync(filePath)) {
			try {
				fs.unlinkSync(filePath);
				logger.info(`Deleted clip: ${filePath}`);
				return { success: true };
			} catch (err) {
				logger.error(`Error deleting clip: ${filePath}`, err);
				return { success: false, error: err.message };
			}
		} else {
			logger.debug(`File not found in clips path: ${filePath}`);
		}
		
		logger.warn(`File not found in any location: ${filename}`);
		return { success: false, error: 'File not found' };
	});

	// Get video metadata (for clips)
	logger.debug('Registering get-video-metadata handler');
	ipcMain.handle('get-video-metadata', async (event, filename) => {
		logger.info(`get-video-metadata handler called for file: ${filename}`);
		try {
			const filePath = path.join(clipsPath, filename);
			logger.debug(`Full path: ${filePath}`);
			
			if (!fs.existsSync(filePath)) {
				logger.warn(`File not found: ${filePath}`);
				return { success: false, error: 'File not found' };
			}

			// Use ffprobe to get video metadata
			logger.debug('Running ffprobe to get video metadata...');
			const ffprobeCommand = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration,codec_name,r_frame_rate -show_entries format=duration,size -of json "${filePath}"`;
			logger.debug(`FFprobe command: ${ffprobeCommand}`);
			
			const { stdout } = await exec(ffprobeCommand);
			logger.debug('FFprobe completed successfully');
			
			const metadata = JSON.parse(stdout);
			const videoStream = metadata.streams[0] || {};
			const format = metadata.format || {};
			
			// Calculate frame rate from fraction
			let frameRate = 0;
			if (videoStream.r_frame_rate) {
				const [numerator, denominator] = videoStream.r_frame_rate.split('/');
				frameRate = Math.round(parseInt(numerator) / parseInt(denominator));
			}
			
			const result = {
				success: true,
				width: videoStream.width,
				height: videoStream.height,
				codec: videoStream.codec_name,
				frameRate,
				duration: parseFloat(format.duration || videoStream.duration || 0),
				size: parseInt(format.size || 0),
				format: 'mp4'
			};
			
			logger.debug('Video metadata retrieved', result);
			return result;
		} catch (error) {
			logger.error('Error getting video metadata:', error);
			return { success: false, error: error.message };
		}
	});

	// Save edited video
	logger.debug('Registering save-edited-video handler');
	ipcMain.handle('save-edited-video', async (event, params) => {
		logger.info('save-edited-video handler called', {
			originalFilename: params.originalFilename,
			newTitle: params.newTitle,
			startTime: params.startTime,
			endTime: params.endTime,
			enableCompression: params.enableCompression,
			compressSizeMB: params.compressSizeMB
		});
		
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
			logger.debug(`Original file path: ${originalPath}`);
			
			if (!fs.existsSync(originalPath)) {
				logger.warn(`Original file not found: ${originalPath}`);
				return { success: false, error: 'Original file not found' };
			}

			// Get the original metadata to determine if content is being modified
			logger.debug('Running ffprobe to get original video metadata...');
			const ffprobeCommand = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration,codec_name,r_frame_rate -show_entries format=duration,size -of json "${originalPath}"`;
			
			const { stdout } = await exec(ffprobeCommand);
			logger.debug('FFprobe completed successfully');
			
			const metadata = JSON.parse(stdout);
			const originalDuration = parseFloat(metadata.format.duration || 0);
			const originalSizeBytes = parseInt(metadata.format.size || 0);
			const originalSizeMB = originalSizeBytes / (1024 * 1024);
			
			logger.debug('Original video stats', {
				duration: originalDuration,
				sizeBytes: originalSizeBytes,
				sizeMB: originalSizeMB
			});
			
			// Determine if we're modifying content (trimming or compression)
			const isTrimming = Math.abs(startTime) > 0.1 || Math.abs(endTime - originalDuration) > 0.1;
			
			// Only consider compression if it's enabled AND target size is smaller than current size
			const isCompressionEffective = enableCompression && compressSizeMB < originalSizeMB;
			const isContentModified = isTrimming || isCompressionEffective;
			const isTitleChanged = newTitle.trim() !== originalFilename;
			
			logger.debug('Edit analysis', {
				isTrimming,
				isCompressionEffective,
				isContentModified,
				isTitleChanged
			});
			
			// Case 0: No changes at all - do nothing
			if (!isContentModified && !isTitleChanged) {
				logger.info('No changes detected, returning original file');
				return {
					success: true,
					filename: originalFilename,
					path: originalPath,
					message: 'No changes were needed'
				};
			}
			
			// Case 1: Title-only change (no content modification)
			if (isTitleChanged && !isContentModified) {
				logger.info('Title-only change detected, renaming file');
				const newFileName = newTitle.trim().endsWith('.mp4') ? newTitle.trim() : `${newTitle.trim()}.mp4`;
				const newPath = path.join(clipsPath, newFileName);
				logger.debug(`New file path: ${newPath}`);
				
				// Check if target filename already exists
				if (fs.existsSync(newPath) && newPath !== originalPath) {
					logger.warn(`Target filename already exists: ${newFileName}`);
					return { 
						success: false, 
						error: `A file named "${newFileName}" already exists. Please choose a different name.`
					};
				}
				
				try {
					// Simply rename the file
					logger.debug(`Renaming file from ${originalPath} to ${newPath}`);
					fs.renameSync(originalPath, newPath);
					logger.info(`File renamed successfully to ${newFileName}`);
					return {
						success: true,
						filename: newFileName,
						path: newPath,
						message: 'File renamed successfully'
					};
				} catch (err) {
					logger.error('Error renaming file:', err);
					return { success: false, error: `Error renaming file: ${err.message}` };
				}
			}
			
			// Case 2: Content modification
			logger.info('Content modification detected, processing video');
			
			// Determine output filename
			let outputFilename;
			if (!isTitleChanged) {
				// Same title but content modified - add _edit suffix
				const baseName = path.basename(originalFilename, '.mp4');
				outputFilename = `${baseName}_edit.mp4`;
				logger.debug(`Using modified filename with _edit suffix: ${outputFilename}`);
			} else {
				// New title and content modified
				outputFilename = newTitle.trim().endsWith('.mp4') ? newTitle.trim() : `${newTitle.trim()}.mp4`;
				logger.debug(`Using user-specified filename: ${outputFilename}`);
			}
			
			const outputPath = path.join(clipsPath, outputFilename);
			logger.debug(`Output path: ${outputPath}`);
			
			// Check if target filename already exists
			if (fs.existsSync(outputPath) && outputPath !== originalPath) {
				logger.warn(`Target filename already exists: ${outputFilename}`);
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
				logger.debug(`Calculated target bitrate for compression: ${targetBitrate} bps`);
			} else {
				// Use a high bitrate to maintain quality if not compressing
				targetBitrate = "5000k";
				logger.debug(`Using high quality bitrate: ${targetBitrate}`);
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
			logger.debug(`Using FFmpeg at: ${ffmpegPath}`);
			logger.debug('FFmpeg command:', { command: ffmpegPath, args: ffmpegArgs });
			
			logger.info('Starting FFmpeg process for video editing...');
			const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
			
			const ffmpegResult = await new Promise((resolve, reject) => {
				let stdoutData = '';
				let stderrData = '';
				
				ffmpegProcess.stdout.on('data', (data) => {
					const chunk = data.toString();
					stdoutData += chunk;
					logger.debug(`FFmpeg stdout: ${chunk.trim()}`);
				});
				
				ffmpegProcess.stderr.on('data', (data) => {
					const chunk = data.toString();
					stderrData += chunk;
					if (chunk.includes('frame=') || chunk.includes('time=')) {
						logger.debug(`FFmpeg progress: ${chunk.trim()}`);
					} else {
						logger.debug(`FFmpeg stderr: ${chunk.trim()}`);
					}
				});
				
				ffmpegProcess.on('close', (code) => {
					if (code === 0) {
						logger.info(`FFmpeg completed successfully, output at: ${finalOutputPath}`);
						resolve({ 
							success: true, 
							filename: outputFilename,
							path: finalOutputPath
						});
					} else {
						logger.error(`FFmpeg exited with code ${code}`, { 
							stderr: stderrData.substring(stderrData.length - 500) // Last 500 chars of stderr 
						});
						reject(new Error(`FFmpeg exited with code ${code}`));
					}
				});
				
				ffmpegProcess.on('error', (error) => {
					logger.error('FFmpeg process error:', error);
					reject(error);
				});
			});

			let operationDescription;
			if (isTrimming && isCompressionEffective) {
				operationDescription = 'Video trimmed, compressed, and saved successfully';
			} else if (isTrimming) {
				operationDescription = 'Video trimmed and saved successfully';
			} else if (isCompressionEffective) {
				operationDescription = 'Video compressed and saved successfully';
			} else {
				operationDescription = 'Video processed and saved successfully';
			}
			
			logger.info(operationDescription, {
				outputFile: ffmpegResult.filename,
				duration: duration,
				compression: isCompressionEffective
			});
			
			return {
				...ffmpegResult,
				message: operationDescription
			};
		} catch (error) {
			logger.error('Error saving edited video:', error);
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

	logger.info('IPC handlers setup complete');
}

// Make sure to unregister shortcuts when the app is about to quit
export function cleanupIpcHandlers() {
	logger.info('Cleaning up IPC handlers...');
	unregisterHotkeys();
	logger.debug('IPC handlers cleanup complete');
}