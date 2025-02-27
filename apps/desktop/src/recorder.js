import { spawn } from 'child_process';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';


// Load environment variables
dotenv.config();

// Get paths
const recordingsPath = path.join(app.getPath('videos'), 'GCASP/recordings');
const clipsPath = path.join(app.getPath('videos'), 'GCASP/clips');
const getFFmpegPath = () => {
	return process.env.FFMPEG_EXECUTABLE_PATH || 'ffmpeg';
};

// Single recording process and buffer management
let isRecording = false;
let recordingSegments = [];
let activeProcess = null; // Track the active FFmpeg process
const MAX_SEGMENTS = 5; // Keep 5 segments (5 seconds each)

// Configuration - can be overridden from .env
const config = {
  // Default to 1080p (1920x1080) if not specified in env
  width: process.env.CAPTURE_WIDTH ? parseInt(process.env.CAPTURE_WIDTH) : 1920,
  height: process.env.CAPTURE_HEIGHT ? parseInt(process.env.CAPTURE_HEIGHT) : 1080,
  // Maximum framerate
  fps: process.env.CAPTURE_FPS ? parseInt(process.env.CAPTURE_FPS) : 30
};

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
	
	// Start the recording loop
	recordSegment();
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
		
		const outputPath = path.join(recordingsPath, `segment_${timestamp}.mp4`);
		
    // Set up platform-specific capture commands for main monitor only
    let captureArgs;
    if (process.platform === 'win32') {
      // Windows: Use gdigrab with primary monitor only
      captureArgs = [
        '-f', 'gdigrab',
        '-framerate', config.fps.toString(),
        '-offset_x', '0',
        '-offset_y', '0',
        '-video_size', `${config.width}x${config.height}`,
        '-draw_mouse', '1',
        '-i', 'desktop'
      ];
    } else if (process.platform === 'darwin') {
      // macOS: Use avfoundation with specific resolution
      captureArgs = [
        '-f', 'avfoundation',
        '-framerate', config.fps.toString(),
        '-video_size', `${config.width}x${config.height}`,
        '-i', '1:none' // Capture display 1, no audio
      ];
    } else {
      // Linux: Use x11grab with specific resolution
      captureArgs = [
        '-f', 'x11grab',
        '-framerate', config.fps.toString(),
        '-video_size', `${config.width}x${config.height}`,
        '-i', ':0.0+0,0', // Primary display, offset 0,0
      ];
    }
    
    // Build FFmpeg command for this segment
    const args = [
      '-y',
      ...captureArgs,
      '-t', '5', // 5 second segments
      '-c:v', 'libx264',
      '-preset', 'ultrafast', // Fastest encoding
      '-pix_fmt', 'yuv420p',
      '-vf', 'scale=1920:1080', // Scale down to 1080p for efficient storage
      outputPath
    ];
		
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
						path: outputPath
					});
					
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

// Stop the continuous recording process
export function stopContinuousRecording() {
	isRecording = false;
	
	// Terminate any active FFmpeg process
	if (activeProcess) {
		try {
			// Send SIGTERM to gracefully terminate the process
			if (process.platform === 'win32') {
				// On Windows, use taskkill
				const { execSync } = require('child_process');
				execSync(`taskkill /pid ${activeProcess.pid} /f /t`);
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

// Create a clip from the most recent recording segment
export async function createClip() {
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
		console.error('Error creating clip:', error);
		return { success: false, error: error.message };
	}
}

// Handle cleanup if module is unloaded
process.on('exit', () => {
	stopContinuousRecording();
});