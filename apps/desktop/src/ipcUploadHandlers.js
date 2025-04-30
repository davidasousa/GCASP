import { ipcMain } from 'electron';
import { getModuleLogger } from './logger';
import { app } from 'electron';
import axios from 'axios';
import FormData from 'form-data';
import path from 'path';
import fs from 'fs';
import { API_URL } from './config';

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

// Upload a clip file to the server
async function uploadClipFile(file, title, token) {
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