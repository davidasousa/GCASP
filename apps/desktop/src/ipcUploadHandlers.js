import { ipcMain } from 'electron';
import { getModuleLogger } from './logger';
import { app } from 'electron';
import axios from 'axios';
import FormData from 'form-data';
import path from 'path';
import fs from 'fs';
import { API_URL } from './config';
import { spawn } from 'child_process';

const logger = getModuleLogger('ipcUploadHandlers.js');

const DEFAULT_API_URL = API_URL;

// Helper to get API URL
const getApiUrl = () => DEFAULT_API_URL;

// Find a clip by title
const findClip = (videoTitle) => {
	const clipsPath = path.join(app.getPath('videos'), 'GCASP/clips');
	const clipFiles = fs.readdirSync(clipsPath);
	const match = clipFiles.find(file => file === videoTitle);

	if (match) {
		return path.join(clipsPath, match); // full path
	} else {
		return null;
	}
};

// Extract metadata using FFmpeg
const extractMetadata = (filePath) => {
	return new Promise((resolve, reject) => {
		logger.debug(`Extracting metadata from ${filePath}`);
		
		// Use FFprobe to get video metadata
		const ffprobe = spawn('ffprobe', [
			'-v', 'error',
			'-select_streams', 'v:0',
			'-show_entries', 'stream=width,height,codec_name,r_frame_rate',
			'-show_entries', 'format=duration,size',
			'-of', 'json',
			filePath
		]);
		
		let stdout = '';
		let stderr = '';
		
		ffprobe.stdout.on('data', (data) => {
			stdout += data.toString();
		});
		
		ffprobe.stderr.on('data', (data) => {
			stderr += data.toString();
		});
		
		ffprobe.on('close', (code) => {
			if (code === 0) {
				try {
					const metadata = JSON.parse(stdout);
					const videoStream = metadata.streams.find(s => s.codec_type === 'video');
					const format = metadata.format || {};
					
					// Calculate frame rate from fraction
					let frameRate = 0;
					if (videoStream && videoStream.r_frame_rate) {
						const [numerator, denominator] = videoStream.r_frame_rate.split('/');
						frameRate = Math.round(parseInt(numerator) / parseInt(denominator));
					}
					
					const result = {
						width: videoStream ? videoStream.width : null,
						height: videoStream ? videoStream.height : null,
						duration: parseFloat(format.duration || 0),
						size: parseInt(format.size || 0),
						codec: videoStream ? videoStream.codec_name : null,
						frameRate
					};
					
					logger.debug('Metadata extraction successful', result);
					resolve(result);
				} catch (error) {
					logger.error('Error parsing ffprobe output:', error);
					reject(new Error('Failed to parse metadata: ' + error.message));
				}
			} else {
				logger.error(`FFprobe process exited with code ${code}: ${stderr}`);
				reject(new Error(`FFprobe failed with code ${code}`));
			}
		});
		
		ffprobe.on('error', (err) => {
			logger.error('Failed to start FFprobe:', err);
			reject(new Error('Failed to start FFprobe: ' + err.message));
		});
	});
};

// Upload a clip file to the server with metadata
async function uploadClipFile(file, title, token) {
	// First extract metadata
	let metadata;
	try {
		metadata = await extractMetadata(file);
		logger.info('Metadata extracted successfully', metadata);
	} catch (error) {
		logger.warn('Metadata extraction failed, continuing with upload:', error);
		// Default empty metadata if extraction fails
		metadata = {
			width: null,
			height: null,
			duration: 0,
			size: fs.statSync(file).size,
			codec: null,
			frameRate: null
		};
	}

	// Create form data with file and metadata
	const form = new FormData();

	// Read file stats to show upload progress
	const stats = fs.statSync(file);
	const totalSize = stats.size;
	logger.debug(`Uploading file: ${path.basename(file)}, size: ${totalSize} bytes`);
	
	// Create readable stream with progress tracking
	const fileStream = fs.createReadStream(file);
	let uploadedBytes = 0;
	
	fileStream.on('data', (chunk) => {
		uploadedBytes += chunk.length;
		const progress = Math.round((uploadedBytes / totalSize) * 100);
		logger.debug(`Upload progress: ${progress}%`);
	});

	// Append the video file
	form.append("video", fileStream, {
		filename: path.basename(file),
		contentType: "video/mp4",
	});

	// Append the title
	form.append("title", title);
	
	// Append metadata as JSON
	form.append("metadata", JSON.stringify(metadata));

	try {
		// Send the POST request with the form data
		const response = await axios.post(`${getApiUrl()}/videos/upload`, form, {
			headers: {
				...form.getHeaders(),
				Authorization: `Bearer ${token}`,
			},
			// Increase timeout for large files
			timeout: 300000, // 5 minutes
			// Add progress tracking for axios
			onUploadProgress: (progressEvent) => {
				const percentCompleted = Math.round(
					(progressEvent.loaded * 100) / progressEvent.total
				);
				logger.debug(`Upload progress (axios): ${percentCompleted}%`);
			},
		});

		logger.info("Upload successful:", response.data);
		return {
			success: true,
			data: response.data
		};
	} catch (error) {
		logger.error("Upload failed:", error.response?.data || error.message);
		return {
			success: false,
			status: error.response?.status || 500,
			message: error.response?.data?.message || "Upload failed",
		};
	}
}

// Initialize settings and register handlers
export function setupUploadHandlers() {
	logger.debug("Setting Up Upload Handlers");
	
	// Trigger Upload Clip
	logger.debug("Registering Upload");
	ipcMain.handle('trigger-upload-clip', async (event, title, token) => {
		logger.debug('Uploading Clip');
		const clip = findClip(title);

		if (!clip) {
			logger.error(`Clip not found: ${title}`);
			return { 
				success: false,
				message: 'Clip file not found'
			};
		}

		try {
			const response = await uploadClipFile(clip, title, token);
			return response;
		} catch (error) {
			logger.error('Upload failed:', error.message);
			return { 
				success: false, 
				message: 'Upload failed: ' + error.message 
			};
		}
	});
}

export default setupUploadHandlers;