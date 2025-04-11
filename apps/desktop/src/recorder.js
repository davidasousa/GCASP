import { spawn } from 'child_process';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { getCurrentSettings } from './settings';
import { getModuleLogger } from './logger';

const logger = getModuleLogger('recorder.js');

// Load environment variables
dotenv.config();

// Get paths
const recordingsPath = path.join(app.getPath('videos'), 'GCASP/recordings');
const clipsPath = path.join(app.getPath('videos'), 'GCASP/clips');
const clipInstructionsPath = path.join(app.getPath('videos'), 'GCASP/clipInstructions.txt');

logger.debug(`Recorder module initialized with paths:`, {
    recordingsPath,
    clipsPath,
    clipInstructionsPath
});

// Get FFmpeg path with fallback
const getFFmpegPath = () => {
    return process.env.FFMPEG_EXECUTABLE_PATH || 'ffmpeg';
};

// Single recording process and buffer management
let isRecording = false;
let recordingSegments = [];
let activeProcess = null; // Track the active FFmpeg process

// Cache for display information
let cachedDisplays = [];
let cachedConfig = null;

// Global variables to track recording progress
let currentSegmentStartTime = 0;
let currentSegmentIndex = 0;

// Segment configuration
const SEGMENT_LENGTH = 3; // Recording Length In Seconds
// MAX_SEGMENTS will be calculated dynamically based on settings

// Initialize display cache
function initializeDisplayCache() {
    try {
        const { screen } = require('electron');
        cachedDisplays = screen.getAllDisplays().map(display => {
            // Calculate actual physical dimensions using the scale factor
            const physicalWidth = Math.round(display.bounds.width * display.scaleFactor);
            const physicalHeight = Math.round(display.bounds.height * display.scaleFactor);
            
            return {
                ...display,
                physicalWidth,
                physicalHeight,
                isScaled: display.scaleFactor > 1
            };
        });
        
        logger.info(`Display cache initialized with ${cachedDisplays.length} monitors`);
        return true;
    } catch (error) {
        logger.error('Error initializing display cache:', error);
        return false;
    }
}

// Update display cache (call this when settings change)
function updateDisplayCache() {
    return initializeDisplayCache();
}

// Get current recording configuration from settings
function getRecordingConfig() {
    // If we already have a cached config, use it
    if (cachedConfig) {
        return cachedConfig;
    }
    
    // Otherwise load from settings using cached version
    const settings = getCurrentSettings();
    cachedConfig = {
        width: settings.resolution?.width || 1920,
        height: settings.resolution?.height || 1080,
        fps: settings.fps || 30,
        selectedMonitor: settings.selectedMonitor || "0"
    };
    
    logger.debug('Recording configuration loaded', cachedConfig);
    return cachedConfig;
}

// Get the maximum number of segments to keep based on settings
function getMaxSegments() {
    const settings = getCurrentSettings();
    const desiredClipLength = settings.recordingLength || 20; // Default to 20 seconds
    // Calculate segments needed (round up to ensure we have enough)
    const segments = Math.ceil(desiredClipLength / SEGMENT_LENGTH) + 1; // +1 for safety
    logger.debug(`Maximum segments calculated: ${segments} (for ${desiredClipLength}s clip length)`);
    return segments;
}

// Start the continuous recording process
export function startContinuousRecording() {
    if (isRecording) {
        logger.debug('Recording already in progress, ignoring start request');
        return;
    }
    
    logger.info('Starting continuous recording process');
    isRecording = true;
    
    // Ensure directories exist
    if (!fs.existsSync(recordingsPath)) {
        logger.info(`Creating recordings directory: ${recordingsPath}`);
        fs.mkdirSync(recordingsPath, { recursive: true });
    }
    if (!fs.existsSync(clipsPath)) {
        logger.info(`Creating clips directory: ${clipsPath}`);
        fs.mkdirSync(clipsPath, { recursive: true });
    }
    
    // Initialize display cache if not already done
    if (cachedDisplays.length === 0) {
        initializeDisplayCache();
    }
    
    // Start the recording loop
    logger.debug('Starting recording segment loop');
    recordSegment();
}

// Stop the continuous recording process
export function stopContinuousRecording() {
    if (!isRecording) {
        logger.debug('Recording not in progress, ignoring stop request');
        return;
    }
    
    logger.info('Stopping continuous recording process');
    isRecording = false;
    
    // Terminate any active FFmpeg process
    if (activeProcess) {
        try {
            // Send SIGTERM to gracefully terminate the process
            if (process.platform === 'win32') {
                // On Windows, use taskkill
                try {
                    logger.debug(`Terminating FFmpeg process with PID ${activeProcess.pid} using taskkill`);
                    execSync(`taskkill /pid ${activeProcess.pid} /f /t`);
                } catch (e) {
                    logger.warn('Error terminating FFmpeg process with taskkill:', e);
                }
            } else {
                // On Unix systems
                logger.debug(`Terminating FFmpeg process with PID ${activeProcess.pid} using SIGTERM`);
                activeProcess.kill('SIGTERM');
            }
        } catch (e) {
            logger.error('Error terminating FFmpeg process:', e);
        }
        activeProcess = null;
    }
    
    logger.debug('Continuous recording stopped');
}

// Clear all recording segments and files
function clearRecordingSegments() {
    // First clear the array
    const segmentCount = recordingSegments.length;
    recordingSegments = [];
    logger.debug(`Cleared ${segmentCount} segments from memory`);
    
    // Then delete all recording files
    try {
        if (!fs.existsSync(recordingsPath)) {
            logger.warn(`Recordings path doesn't exist: ${recordingsPath}`);
            return;
        }
        
        const files = fs.readdirSync(recordingsPath);
        const videoFiles = files.filter(file => file.endsWith('.mp4'));
        logger.info(`Found ${videoFiles.length} recording files to delete`);
        
        let deletedCount = 0;
        let errorCount = 0;
        
        videoFiles.forEach(file => {
            try {
                const filePath = path.join(recordingsPath, file);
                fs.unlinkSync(filePath);
                logger.debug(`Deleted recording segment: ${filePath}`);
                deletedCount++;
            } catch (err) {
                // Ignore errors when deleting individual files
                logger.warn(`Could not delete file: ${file} - ${err.message}`);
                errorCount++;
            }
        });
        
        logger.info(`Recording cleanup complete: ${deletedCount} files deleted, ${errorCount} errors`);
    } catch (err) {
        logger.error('Error during clearing recordings:', err);
    }
}

// Restart recording with new settings
export async function restartRecordingWithNewSettings() {
    logger.info('Restarting recording with new settings...');
    
    // First stop current recording
    stopContinuousRecording();
    
    // Wait a moment for the process to fully terminate
    logger.debug('Waiting for processes to terminate before restart...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Clear all segments and recording files
    logger.debug('Clearing existing recording segments...');
    clearRecordingSegments();
    
    // Update cached configuration from settings
    logger.debug('Resetting configuration cache...');
    cachedConfig = null; // Force reload of settings
    getRecordingConfig(); // Load new settings into cache
    
    // Update display cache
    logger.debug('Updating display cache...');
    updateDisplayCache();
    
    // Start recording again with new settings
    logger.info('Starting recording with new settings');
    startContinuousRecording();
    
    return true;
}

// Record a single segment in the continuous recording loop
async function recordSegment() {
	if (!isRecording) {
		logger.debug('Recording stopped, exiting recording loop');
		return;
	}
	
	try {
		// Create timestamp for this segment
		const timestamp = new Date().toISOString()
			.replace(/[:.]/g, '-')
			.replace('T', '_')
			.replace('Z', '');
		
		const outputPath = path.join(recordingsPath, `clip_${timestamp}.mp4`);
		logger.debug(`Starting new segment recording: ${path.basename(outputPath)}`);
		
		// Set the start time for this segment - IMPORTANT FOR TIMING
		currentSegmentStartTime = Date.now();
		currentSegmentIndex++;
		
		// Get current config from cache
		const config = getRecordingConfig();
		
		// Use cached display information instead of querying each time
		if (cachedDisplays.length === 0) {
			// Fallback if cache is empty for some reason
			initializeDisplayCache();
		}
		
		const selectedMonitorIndex = parseInt(config.selectedMonitor, 10);
		const selectedDisplay = cachedDisplays[selectedMonitorIndex] || cachedDisplays[0];
		
		const captureWidth = selectedDisplay.isScaled 
		? selectedDisplay.physicalWidth 
		: selectedDisplay.bounds.width;
		
		const captureHeight = selectedDisplay.isScaled 
			? selectedDisplay.physicalHeight 
			: selectedDisplay.bounds.height;
	
		logger.debug(`Capturing from monitor ${config.selectedMonitor}: ${captureWidth}x${captureHeight} (Scale factor: ${selectedDisplay.scaleFactor})`);
	
		// Capture the entire selected monitor at its physical resolution
		const cropFilter = `crop=${captureWidth}:${captureHeight}:${selectedDisplay.bounds.x}:${selectedDisplay.bounds.y}`;

		const captureArgs = [
			'-f', 'dshow', // for Windows DirectShow (not gdigrab for combining audio/video)
			'-i', 'audio=virtual-audio-capturer', // audio input
			'-f', 'dshow',
			'-i', 'video=screen-capture-recorder', // video input
			'-filter_complex', `[1:v]${cropFilter}[v]`, // if you're cropping only the video stream
			'-map', '[v]',
			'-map', '0:a', // map audio from first input
			'-r', config.fps.toString(),
			'-draw_mouse', '1',
		];
		  

		// Build FFmpeg command for this segment
		const args = [
			'-hide_banner',
			'-loglevel', 'error',
			'-y',
			...captureArgs,
			'-t', SEGMENT_LENGTH.toString(), // Segment length in seconds
			'-c:v', 'libx264',
			'-preset', 'ultrafast', 
			'-pix_fmt', 'yuv420p'
		];
		
		// Only add scaling if the selected resolution is different from the capture dimensions
		if (config.width !== captureWidth || config.height !== captureHeight) {
			// Scale to the target resolution while preserving aspect ratio
			args.push('-vf', `scale=${config.width}:${config.height}:force_original_aspect_ratio=decrease,pad=${config.width}:${config.height}:(ow-iw)/2:(oh-ih)/2`);
		}
		
		// Add output path
		args.push(outputPath);
		
		// Record segment
		logger.debug(`Executing FFmpeg process: ${getFFmpegPath()} ${args.join(' ')}`);
		await new Promise((resolve, reject) => {
			const ffmpegProcess = spawn(getFFmpegPath(), args);
			activeProcess = ffmpegProcess; // Store the reference to current process
			
			// Log stderr to help with debugging
			ffmpegProcess.stderr.on('data', (data) => {
				const logLine = data.toString().trim();
				// Only log if it's not just a progress update
				if (!logLine.includes('frame=') && !logLine.includes('time=') && logLine.length > 0) {
					logger.debug(`FFmpeg: ${logLine}`);
				}
			});
			
			ffmpegProcess.on('close', (code) => {
				activeProcess = null; // Clear the reference when process ends
				
				if (code === 0) {
					logger.debug(`Segment recorded successfully: ${path.basename(outputPath)}`);
					// Add to segments list and maintain buffer size
					recordingSegments.push({
						timestamp,
						path: outputPath,
						filename: path.basename(outputPath),
						segmentIndex: currentSegmentIndex
					});
					
					// Get current max segments based on settings
					const MAX_SEGMENTS = getMaxSegments();
					
					// Keep only the last MAX_SEGMENTS
					while (recordingSegments.length > MAX_SEGMENTS) {
						const oldSegment = recordingSegments.shift();
						try {
							if (fs.existsSync(oldSegment.path)) {
								fs.unlinkSync(oldSegment.path);
								logger.debug(`Removed old segment: ${path.basename(oldSegment.path)}`);
							}
						} catch (e) {
							// Ignore errors when cleaning up
							logger.warn(`Could not delete old segment: ${e.message}`);
						}
					}
					
					resolve();
				} else {
					logger.error(`FFmpeg exited with code ${code}`);
					reject(new Error(`FFmpeg exited with code ${code}`));
				}
			});
			
			ffmpegProcess.on('error', (err) => {
				logger.error('FFmpeg process error:', err);
				reject(err);
			});
		});
		
		// Continue the loop if still recording
		if (isRecording) {
			recordSegment();
		}
	} catch (error) {
		logger.error('Error in recording loop:', error);
		
		// Retry after a short delay
		if (isRecording) {
			logger.info('Retrying recording after error...');
			setTimeout(recordSegment, 1000);
		}
	}
}

// Function to get elapsed time in current segment
function getCurrentSegmentElapsedTime() {
	if (currentSegmentStartTime === 0) {
		return 0;
	}
	
	const elapsed = (Date.now() - currentSegmentStartTime) / 1000; // in seconds
	return Math.min(elapsed, SEGMENT_LENGTH); // Cap at segment length
}

// Create a clip by splicing together segments
export async function createClip(clipTimestamp, clipSettings, hotkeyTime = null) {
	if (recordingSegments.length === 0) {
		logger.warn('Cannot create clip: No recording segments available');
		return { success: false, error: 'No recording segments available' };
	}
	
	try {
		// Default timestamp if not provided
		if (!clipTimestamp) {
			clipTimestamp = new Date().toISOString()
				.replace(/[:.]/g, '-')
				.replace('T', '_')
				.replace('Z', '');
		}
		
		// Default settings if not provided
		const settings = clipSettings || { clipLength: 20 };
		
		// Ensure clip length is within bounds
		const clipLength = Math.max(5, Math.min(120, settings.clipLength));
		
		// Capture current segment elapsed time
		const elapsedTimeInCurrentSegment = getCurrentSegmentElapsedTime();
		
		// Keep track of the current segment index when hotkey was pressed
		const hotkeySegmentIndex = currentSegmentIndex;
		
		logger.debug(`Hotkey pressed at ${elapsedTimeInCurrentSegment.toFixed(2)}s into segment ${hotkeySegmentIndex}`);
		
		// Wait for current segment to complete (if recording is in progress)
		if (isRecording && activeProcess) {
			logger.debug('Recording in progress, waiting for current segment to complete');
			const currentProcess = activeProcess;
			const maxWaitTime = SEGMENT_LENGTH * 1000 + 1000;
			const startTime = Date.now();
			
			while (activeProcess === currentProcess && Date.now() - startTime < maxWaitTime) {
				await new Promise(resolve => setTimeout(resolve, 100));
			}
			
			logger.debug(`Waited ${Date.now() - startTime}ms for segment to complete`);
		}
		
		logger.info(`Creating clip with length: ${clipLength}s, timestamp: ${clipTimestamp}`);
		
		const rawOutputPath = path.join(clipsPath, `clip_${clipTimestamp}_raw.mp4`);
		const outputPath = path.join(clipsPath, `clip_${clipTimestamp}.mp4`);
		
		// Get available segments
		const segments = [...recordingSegments];
		
		// Sort chronologically by segment index (more reliable than timestamps)
		segments.sort((a, b) => {
			return (a.segmentIndex || 0) - (b.segmentIndex || 0);
		});
		
		logger.debug(`Total segments available: ${segments.length}`);
		
		// Find the segment containing the hotkey press
		const currentSegmentIsComplete = segments.some(seg => seg.segmentIndex === hotkeySegmentIndex);
		
		logger.debug(`Hotkey segment (${hotkeySegmentIndex}) is complete: ${currentSegmentIsComplete}`);
		
		// Select segments up to and including the one where the hotkey was pressed
		const segmentsToUse = segments.filter(segment => 
			(segment.segmentIndex || 0) <= hotkeySegmentIndex);
		
		// Sort by segment index to ensure chronological order
		segmentsToUse.sort((a, b) => (a.segmentIndex || 0) - (b.segmentIndex || 0));
		
		logger.debug(`Found ${segmentsToUse.length} segments up to hotkey press`);
		
		// Calculate how many full segments to include
		const totalSegmentsLength = segmentsToUse.length * SEGMENT_LENGTH;
		
		// The exact end position in the concatenated video
		const exactEndPosition = (segmentsToUse.length - 1) * SEGMENT_LENGTH + elapsedTimeInCurrentSegment;
		
		logger.debug(`Total segments duration: ${totalSegmentsLength}s`);
		logger.debug(`Exact end position: ${exactEndPosition.toFixed(2)}s`);
		
		// Calculate trim start point to achieve desired clip length
		const trimStartTime = Math.max(0, exactEndPosition - clipLength);
		
		logger.debug(`Trimming to get ${clipLength}s clip: start=${trimStartTime.toFixed(2)}s, end=${exactEndPosition.toFixed(2)}s`);
		
		// Create clip instructions file for FFmpeg concat
		logger.debug(`Writing concat instructions to ${clipInstructionsPath}`);
		fs.writeFileSync(clipInstructionsPath, '', { flag: 'w' });
		
		// Add segments to the instructions file
		let allFilesExist = true;
		segmentsToUse.forEach(segment => {
			if (!fs.existsSync(segment.path)) {
				logger.warn(`Segment file does not exist: ${segment.path}`);
				allFilesExist = false;
				return;
			}
			
			const fileLine = `file '${segment.path.replace(/\\/g, '\\\\')}'`;
			fs.appendFileSync(clipInstructionsPath, fileLine + '\n');
			logger.debug(`Added segment to concat: ${path.basename(segment.path)}`);
		});
		
		if (!allFilesExist) {
			logger.warn('Some segments were missing, proceeding with available segments');
		}
		
		// FFmpeg command to concatenate segments
		const concatArgs = [
			'-y',
			'-f', 'concat',
			'-safe', '0',
			'-i', clipInstructionsPath,
			'-c', 'copy',
			rawOutputPath
		];
		
		// FFmpeg command to trim the concatenated video
		const trimArgs = [
			'-y',
			'-ss', trimStartTime.toString(),
			'-i', rawOutputPath,
			'-to', (exactEndPosition - trimStartTime).toString(),
			'-c', 'copy',
			outputPath
		];
		
		// Function to run FFmpeg process
		function runFfmpegProcess(args) {
			return new Promise((resolve, reject) => {
				const ffmpegProcess = spawn(getFFmpegPath(), args);
				let stderrData = '';
				
				ffmpegProcess.stderr.on('data', (data) => {
					stderrData += data.toString();
					// Log non-progress messages for debugging
					const logLine = data.toString().trim();
					if (!logLine.includes('frame=') && !logLine.includes('time=') && logLine.length > 0) {
						logger.debug(`FFmpeg: ${logLine}`);
					}
				});
				
				ffmpegProcess.on('close', (code) => {
					if (code === 0) {
						resolve();
					} else {
						logger.error('FFmpeg stderr:', stderrData);
						reject(new Error(`FFmpeg process exited with code ${code}`));
					}
				});
				
				ffmpegProcess.on('error', (err) => {
					logger.error('FFmpeg process error:', err);
					reject(err);
				});
			});
		}
		
		// Execute the FFmpeg processes
		logger.debug('Starting concatenation of segments...');
		await runFfmpegProcess(concatArgs);
		logger.info("Raw concatenation completed");
		
		logger.debug('Starting trimming of concatenated video...');
		await runFfmpegProcess(trimArgs);
		logger.info("Trimming completed");
		
		// Clean up temporary file
		try {
			fs.unlinkSync(rawOutputPath);
			logger.debug("Temporary file deleted");
		} catch (err) {
			logger.warn("Could not delete temporary file:", err);
		}
		
		logger.info(`Clip created successfully: ${path.basename(outputPath)}`);
		return {
			success: true,
			filename: path.basename(outputPath),
			path: outputPath
		};
	} catch (error) {
		logger.error('Error creating clip:', error);
		return { success: false, error: error.message };
	}
}

// Handle cleanup if module is unloaded
process.on('exit', () => {
    logger.info('Process exiting, stopping recording');
    stopContinuousRecording();
});