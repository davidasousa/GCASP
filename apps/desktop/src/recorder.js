import { spawn } from 'child_process';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { loadSettings } from './settings';

// Load environment variables
dotenv.config();

// Get paths
const recordingsPath = path.join(app.getPath('videos'), 'GCASP/recordings');
const clipsPath = path.join(app.getPath('videos'), 'GCASP/clips');
const clipInstructionsPath = path.join(app.getPath('videos'), 'GCASP/clipInstructions.txt');

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
		console.log(`Display cache initialized with ${cachedDisplays.length} monitors`);
		return true;
	} catch (error) {
		console.error('Error initializing display cache:', error);
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
	
	// Otherwise load from settings
	const settings = loadSettings();
	cachedConfig = {
		width: settings.resolution?.width || 1920,
		height: settings.resolution?.height || 1080,
		fps: settings.fps || 30,
		selectedMonitor: settings.selectedMonitor || "0"
	};
	
	return cachedConfig;
}

// Get the maximum number of segments to keep based on settings
function getMaxSegments() {
	const settings = loadSettings();
	const desiredClipLength = settings.recordingLength || 20; // Default to 20 seconds
	// Calculate segments needed (round up to ensure we have enough)
	return Math.ceil(desiredClipLength / SEGMENT_LENGTH) + 1; // +1 for safety
}

// Start the continuous recording process
export function startContinuousRecording() {
	if (isRecording) return;
	isRecording = true;
	
	// Ensure directories exist
	if (!fs.existsSync(recordingsPath)) {
		fs.mkdirSync(recordingsPath, { recursive: true });
	}
	if (!fs.existsSync(clipsPath)) {
		fs.mkdirSync(clipsPath, { recursive: true });
	}
	
	// Initialize display cache if not already done
	if (cachedDisplays.length === 0) {
		initializeDisplayCache();
	}
	
	// Start the recording loop
	recordSegment();
}

// Stop the continuous recording process
export function stopContinuousRecording() {
	isRecording = false;
	
	// Terminate any active FFmpeg process
	if (activeProcess) {
		try {
			// Send SIGTERM to gracefully terminate the process
			if (process.platform === 'win32') {
				// On Windows, use taskkill
				try {
					execSync(`taskkill /pid ${activeProcess.pid} /f /t`);
				} catch (e) {
					console.log('Error terminating FFmpeg process with taskkill:', e);
				}
			} else {
				// On Unix systems
				activeProcess.kill('SIGTERM');
			}
		} catch (e) {
			console.log('Error terminating FFmpeg process:', e);
		}
		activeProcess = null;
	}
}

// Clear all recording segments and files
function clearRecordingSegments() {
	// First clear the array
	recordingSegments = [];
	
	// Then delete all recording files
	try {
		const files = fs.readdirSync(recordingsPath);
		files.filter(file => file.endsWith('.mp4'))
			.forEach(file => {
				try {
					const filePath = path.join(recordingsPath, file);
					fs.unlinkSync(filePath);
					console.log(`Deleted recording segment: ${filePath}`);
				} catch (err) {
					console.log(`Could not delete file: ${file} - ${err.message}`);
				}
			});
	} catch (err) {
		console.error('Error during clearing recordings:', err);
	}
}

// Restart recording with new settings
export async function restartRecordingWithNewSettings() {
	console.log('Restarting recording with new settings...');
	
	// First stop current recording
	stopContinuousRecording();
	
	// Wait a moment for the process to fully terminate
	await new Promise(resolve => setTimeout(resolve, 500));
	
	// Clear all segments and recording files
	clearRecordingSegments();
	
	// Update cached configuration from settings
	cachedConfig = null; // Force reload of settings
	getRecordingConfig(); // Load new settings into cache
	
	// Update display cache
	updateDisplayCache();
	
	// Start recording again with new settings
	startContinuousRecording();
	
	return true;
}

// Record a single segment in the continuous recording loop
async function recordSegment() {
	if (!isRecording) return;
	
	try {
		// Create timestamp for this segment
		const timestamp = new Date().toISOString()
			.replace(/[:.]/g, '-')
			.replace('T', '_')
			.replace('Z', '');
		
		const outputPath = path.join(recordingsPath, `clip_${timestamp}.mp4`);
		
		// Get current config from cache
		const config = getRecordingConfig();
		
		// Use cached display information instead of querying each time
		if (cachedDisplays.length === 0) {
			// Fallback if cache is empty for some reason
			initializeDisplayCache();
		}
		
		const selectedMonitorIndex = parseInt(config.selectedMonitor, 10);
		const selectedDisplay = cachedDisplays[selectedMonitorIndex] || cachedDisplays[0];
		
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
			args.push('-vf', `scale=${config.width}:${config.height}:force_original_aspect_ratio=decrease,pad=${config.width}:${config.height}:(ow-iw)/2:(oh-ih)/2`);
		}
		
		// Add output path
		args.push(outputPath);
		
		// Record segment
		await new Promise((resolve, reject) => {
			const ffmpegProcess = spawn(getFFmpegPath(), args);
			activeProcess = ffmpegProcess; // Store the reference to current process
			
			ffmpegProcess.on('close', (code) => {
				activeProcess = null; // Clear the reference when process ends
				
				if (code === 0) {
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
							}
						} catch (e) {
							// Ignore errors when cleaning up
							console.log(`Could not delete old segment: ${e.message}`);
						}
					}
					
					resolve();
				} else {
					reject(new Error(`FFmpeg exited with code ${code}`));
				}
			});
			
			ffmpegProcess.on('error', reject);
		});
		
		// Continue the loop if still recording
		if (isRecording) {
			recordSegment();
		}
	} catch (error) {
		console.error('Error in recording loop:', error);
		
		// Retry after a short delay
		if (isRecording) {
			setTimeout(recordSegment, 1000);
		}
	}
}

// Create a clip by splicing together segments
export async function createClip(clipTimestamp, clipSettings) {
	if (recordingSegments.length === 0) {
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
		
		const rawOutputPath = path.join(clipsPath, `clip_${clipTimestamp}_raw.mp4`);
		const outputPath = path.join(clipsPath, `clip_${clipTimestamp}.mp4`);
		
		// Get the needed segments (most recent ones first)
		const segmentsNeeded = Math.ceil(clipLength / SEGMENT_LENGTH);
		
		// Make sure we don't request more segments than we have
		const availableSegments = Math.min(segmentsNeeded, recordingSegments.length);
		const segmentsToUse = recordingSegments.slice(-availableSegments);
		
		// Calculate how much to trim from the beginning
		const totalSegmentLength = segmentsToUse.length * SEGMENT_LENGTH;
		const trimAmount = Math.max(0, totalSegmentLength - clipLength);
		
		// Create clip instructions file for FFmpeg concat
		fs.writeFileSync(clipInstructionsPath, '', { flag: 'w' });
		
		// Add segments in chronological order (oldest first)
		segmentsToUse.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
			.forEach(segment => {
				const fileLine = `file '${segment.path.replace(/\\/g, '\\\\')}'`;
				fs.appendFileSync(clipInstructionsPath, fileLine + '\n');
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
				});
				
				ffmpegProcess.on('close', (code) => {
					if (code === 0) {
						resolve();
					} else {
						console.error('FFmpeg stderr:', stderrData);
						reject(new Error(`FFmpeg process exited with code ${code}`));
					}
				});
				
				ffmpegProcess.on('error', (err) => {
					reject(err);
				});
			});
		}
		
		// Execute the FFmpeg processes
		await runFfmpegProcess(concatArgs);
		console.log("Raw concatenation completed");
		
		await runFfmpegProcess(trimArgs);
		console.log("Trimming completed");
		
		// Clean up temporary file
		try {
			fs.unlinkSync(rawOutputPath);
			console.log("Temporary file deleted");
		} catch (err) {
			console.warn("Could not delete temporary file:", err);
		}
		
		return {
			success: true,
			filename: path.basename(outputPath),
			path: outputPath
		};
	} catch (error) {
		console.error('Error creating clip:', error);
		return { success: false, error: error.message };
	}
}

// Create a simple clip from the most recent segment (fallback method)
export async function createSimpleClip() {
	if (recordingSegments.length === 0) {
		return { success: false, error: 'No recording segments available' };
	}
	
	try {
		// Get most recent segment
		const latestSegment = recordingSegments[recordingSegments.length - 1];
		
		// Create timestamp for the clip
		const timestamp = new Date().toISOString()
			.replace(/[:.]/g, '-')
			.replace('T', '_')
			.replace('Z', '');
		
		const clipFilename = `clip_${timestamp}.mp4`;
		const clipPath = path.join(clipsPath, clipFilename);
		
		// Copy the segment to the clips directory
		// Use readFile/writeFile instead of copyFile to avoid locks
		const videoData = await fs.promises.readFile(latestSegment.path);
		await fs.promises.writeFile(clipPath, videoData);
		
		return {
			success: true,
			filename: clipFilename,
			path: clipPath
		};
	} catch (error) {
		console.error('Error creating simple clip:', error);
		return { success: false, error: error.message };
	}
}

// Handle cleanup if module is unloaded
process.on('exit', () => {
	stopContinuousRecording();
});