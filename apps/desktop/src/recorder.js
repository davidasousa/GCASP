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

// Segment configuration
const SEGMENT_LENGTH = 5; // Recording Length In Seconds
// MAX_SEGMENTS will be calculated dynamically based on settings

// Initialize display cache
function initializeDisplayCache() {
    try {
        const { screen } = require('electron');
        cachedDisplays = screen.getAllDisplays();
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
        
        // Get current config from cache
        const config = getRecordingConfig();
        
        // Use cached display information instead of querying each time
        if (cachedDisplays.length === 0) {
            // Fallback if cache is empty for some reason
            logger.warn('Display cache empty, reinitializing...');
            initializeDisplayCache();
        }
        
        const selectedMonitorIndex = parseInt(config.selectedMonitor, 10);
        const selectedDisplay = cachedDisplays[selectedMonitorIndex] || cachedDisplays[0];
        
        logger.debug(`Capturing from monitor ${config.selectedMonitor}: ${selectedDisplay.bounds.width}x${selectedDisplay.bounds.height}`);
        
        // Capture the entire selected monitor at its native resolution
        const captureArgs = [
            '-f', 'gdigrab',
            '-framerate', config.fps.toString(),
            '-offset_x', selectedDisplay.bounds.x.toString(),
            '-offset_y', selectedDisplay.bounds.y.toString(),
            '-video_size', `${selectedDisplay.bounds.width}x${selectedDisplay.bounds.height}`,
            '-draw_mouse', '1',
            '-i', 'desktop'
        ];

        // Build FFmpeg command for this segment
        const args = [
			'-hide_banner',
			'-loglevel', 'error',
            '-y',
            ...captureArgs,
            '-t', SEGMENT_LENGTH.toString(), // Segment length in seconds
            '-c:v', 'libx264',
            '-preset', 'ultrafast', // Fastest encoding
            '-pix_fmt', 'yuv420p'
        ];
        
        // Only add scaling if the selected resolution is different from the native resolution
        if (config.width !== selectedDisplay.bounds.width || config.height !== selectedDisplay.bounds.height) {
            // Scale to the target resolution while preserving aspect ratio
            logger.debug(`Adding scaling from ${selectedDisplay.bounds.width}x${selectedDisplay.bounds.height} to ${config.width}x${config.height}`);
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
                        filename: path.basename(outputPath)
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

// Create a clip by splicing together segments
export async function createClip(clipTimestamp, clipSettings) {
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
        
        logger.info(`Creating clip with length: ${clipLength}s, timestamp: ${clipTimestamp}`);
        
        const rawOutputPath = path.join(clipsPath, `clip_${clipTimestamp}_raw.mp4`);
        const outputPath = path.join(clipsPath, `clip_${clipTimestamp}.mp4`);
        
        // Get the needed segments (most recent ones first)
        const segmentsNeeded = Math.ceil(clipLength / SEGMENT_LENGTH);
        
        // Make sure we don't request more segments than we have
        const availableSegments = Math.min(segmentsNeeded, recordingSegments.length);
        const segmentsToUse = recordingSegments.slice(-availableSegments);
        
        logger.debug(`Using ${segmentsToUse.length} segments for clip (needed ${segmentsNeeded}, had ${recordingSegments.length})`);
        
        // Calculate how much to trim from the beginning
        const totalSegmentLength = segmentsToUse.length * SEGMENT_LENGTH;
        const trimAmount = Math.max(0, totalSegmentLength - clipLength);
        
        logger.debug(`Total segment length: ${totalSegmentLength}s, trim amount: ${trimAmount}s`);
        
        // Create clip instructions file for FFmpeg concat
        logger.debug(`Writing concat instructions to ${clipInstructionsPath}`);
        fs.writeFileSync(clipInstructionsPath, '', { flag: 'w' });
        
        // Add segments in chronological order (oldest first)
        segmentsToUse.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
            .forEach(segment => {
                const fileLine = `file '${segment.path.replace(/\\/g, '\\\\')}'`;
                fs.appendFileSync(clipInstructionsPath, fileLine + '\n');
                logger.debug(`Added segment to concat: ${path.basename(segment.path)}`);
            });
        
        // FFmpeg command to concatenate segments
        const concatArgs = [
            '-y',
            '-f', 'concat',
            '-safe', '0',
            '-i', clipInstructionsPath,
            '-c', 'copy',
            rawOutputPath
        ];
        
        // FFmpeg command to trim the concatenated video to the desired length
        const trimArgs = [
            '-y',
            '-ss', trimAmount.toString(),
            '-i', rawOutputPath,
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

// Create a simple clip from the most recent segment (fallback method)
export async function createSimpleClip() {
    if (recordingSegments.length === 0) {
        logger.warn('Cannot create simple clip: No recording segments available');
        return { success: false, error: 'No recording segments available' };
    }
    
    try {
        // Get most recent segment
        const latestSegment = recordingSegments[recordingSegments.length - 1];
        logger.info(`Creating simple clip from most recent segment: ${path.basename(latestSegment.path)}`);
        
        // Create timestamp for the clip
        const timestamp = new Date().toISOString()
            .replace(/[:.]/g, '-')
            .replace('T', '_')
            .replace('Z', '');
        
        const clipFilename = `clip_${timestamp}.mp4`;
        const clipPath = path.join(clipsPath, clipFilename);
        
        // Copy the segment to the clips directory
        // Use readFile/writeFile instead of copyFile to avoid locks
        logger.debug(`Copying segment data to ${clipPath}`);
        const videoData = await fs.promises.readFile(latestSegment.path);
        await fs.promises.writeFile(clipPath, videoData);
        
        logger.info(`Simple clip created successfully: ${clipFilename}`);
        return {
            success: true,
            filename: clipFilename,
            path: clipPath
        };
    } catch (error) {
        logger.error('Error creating simple clip:', error);
        return { success: false, error: error.message };
    }
}

// Handle cleanup if module is unloaded
process.on('exit', () => {
    logger.info('Process exiting, stopping recording');
    stopContinuousRecording();
});