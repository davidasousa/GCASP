import { ipcMain } from 'electron';
import { getModuleLogger } from './logger';
import { app } from 'electron';
import axios from 'axios';
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
		return path.join(clipsPath, match);
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
					const videoStream = metadata.streams.find(s => s.codec_type === 'video') || metadata.streams[0];
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

// Upload a clip file to S3 using presigned URL
async function uploadClipWithPresignedUrl(file, title, token) {
	logger.info(`Starting direct-to-S3 upload for: ${path.basename(file)}`);
	
	try {
		// Step 1: Extract metadata from the file
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
		
		// Read file stats
		const stats = fs.statSync(file);
		const totalSize = stats.size;
		logger.debug(`File: ${path.basename(file)}, size: ${totalSize} bytes`);
		
		// Step 2: Request a presigned URL from the server
		logger.debug('Requesting presigned upload URL from server');
		const presignedUrlResponse = await axios.post(
			`${getApiUrl()}/videos/request-upload-url`,
			{
				filename: path.basename(file),
				contentType: 'video/mp4',
				fileSize: totalSize
			},
			{
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json'
				},
				timeout: 30000 // 30 second timeout for this request
			}
		);
		
		// Check if we got a valid response
		if (!presignedUrlResponse.data || !presignedUrlResponse.data.uploadUrl) {
			throw new Error('Invalid response from server when requesting upload URL');
		}
		
		const { 
			uploadUrl, 
			videoId, 
			s3Key, 
			cloudFrontUrl 
		} = presignedUrlResponse.data;
		
		logger.info(`Received presigned URL for upload, videoId: ${videoId}`);
		
		// Step 3: Upload the file directly to S3 using the presigned URL
		logger.debug('Starting direct upload to S3');
		
		// Create a read stream from the file
		const fileStream = fs.createReadStream(file);
		let uploadedBytes = 0;
		
		// Create a transform stream to track progress
		fileStream.on('data', (chunk) => {
			uploadedBytes += chunk.length;
			const progress = Math.round((uploadedBytes / totalSize) * 100);
			if (progress % 5 === 0) { // Log every 5%
				logger.debug(`Upload progress: ${progress}%`);
			}
		});
		
		// Upload directly to S3 using the presigned URL
		const fileBuffer = fs.readFileSync(file);
		
		// To provide progress, we'll use onUploadProgress
		logger.debug('Uploading file to S3 via presigned URL');
		await axios.put(uploadUrl, fileBuffer, {
			headers: {
				'Content-Type': 'video/mp4',
				'Content-Length': totalSize.toString()
			},
			maxContentLength: Infinity,
			maxBodyLength: Infinity,
			timeout: 600000, // 10 minutes
			onUploadProgress: (progressEvent) => {
				const percentCompleted = Math.round(
					(progressEvent.loaded * 100) / progressEvent.total
				);
				if (percentCompleted % 5 === 0) { // Log every 5%
					logger.debug(`S3 upload progress: ${percentCompleted}%`);
				}
			}
		});
		
		logger.info('File successfully uploaded to S3');
		
		// Step 4: Notify the server that the upload is complete
		logger.debug('Notifying server of completed upload');
		const completeResponse = await axios.post(
			`${getApiUrl()}/videos/complete-upload`,
			{
				videoId,
				s3Key,
				title: path.basename(file, path.extname(file)), // Remove extension
				fileSize: totalSize,
				metadata
			},
			{
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json'
				},
				timeout: 30000 // 30 second timeout
			}
		);
		
		logger.info('Upload process completed successfully');
		return {
			success: true,
			data: completeResponse.data
		};
	} catch (error) {
		logger.error('Upload failed:', error.response?.data || error.message);
		
		// Improved error handling
		if (error.response) {
			// Server returned an error response
			return {
				success: false,
				status: error.response.status,
				message: error.response.data.message || 'Server error'
			};
		} else if (error.request) {
			// No response received
			return {
				success: false,
				message: 'No response from server. The upload may have timed out.'
			};
		} else {
			// Something else went wrong
			return {
				success: false,
				message: error.message || 'Unknown error during upload'
			};
		}
	}
}

// Initialize settings and register handlers
export function setupUploadHandlers() {
	logger.debug("Setting Up Upload Handlers");
	
	// Trigger Upload Clip
	logger.debug("Registering Upload handler");
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
			// Use the presigned URL upload method
			const response = await uploadClipWithPresignedUrl(clip, title, token);
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