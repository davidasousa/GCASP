import { protocol, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { URL } from 'url';
import { getModuleLogger } from './logger';

const logger = getModuleLogger('videoProtocol.js');

// Custom conversion helper
function nodeStreamToWebStream(nodeStream) {
    return new ReadableStream({
        start(controller) {
            nodeStream.on('data', (chunk) => controller.enqueue(chunk));
            nodeStream.on('end', () => controller.close());
            nodeStream.on('error', (err) => controller.error(err));
        },
        cancel(reason) {
            nodeStream.destroy();
        }
    });
}

// Main folders
const recordingsPath = path.join(app.getPath('videos'), 'GCASP/recordings');
const clipsPath = path.join(app.getPath('videos'), 'GCASP/clips');
const ALLOWED_EXTENSIONS = ['.mp4'];

// Ensure directories exist
const ensureDirectories = () => {
	if (!fs.existsSync(recordingsPath)) {
		logger.info(`Creating recordings directory at ${recordingsPath}`);
		fs.mkdirSync(recordingsPath, { recursive: true, mode: 0o700 });
	} else {
		logger.debug(`Recordings directory exists: ${recordingsPath}`);
	}
	if (!fs.existsSync(clipsPath)) {
		logger.info(`Creating clips directory at ${clipsPath}`);
		fs.mkdirSync(clipsPath, { recursive: true, mode: 0o700 });
	} else {
		logger.debug(`Clips directory exists: ${clipsPath}`);
	}
};

// Path security check to prevent directory traversal
const isPathWithinDirectory = (directory, targetPath) => {
    const relative = path.relative(directory, targetPath);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
};

// More permissive filename validation that still prevents potential security issues
const isSafeFilename = (filename) => {
    // Block filenames with path traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        logger.debug('Blocked path traversal attempt:', filename);
        return false;
    }
    
    // Block filenames with null bytes or control characters
    if (/[\x00-\x1f]/.test(filename)) {
        logger.debug('Blocked control character in filename:', filename);
        return false;
    }
    
    // Otherwise allow more flexible naming
    return true;
};

// Find video in either directory
const findVideoFile = (videoId) => {
    // If the videoId appears to be an IP-like string (e.g. "0.0.0.2"),
    // extract the last segment so that "0.0.0.2" becomes "2".
    if (videoId.includes('.')) {
        const parts = videoId.split('.');
        videoId = parts[parts.length - 1];
    }

    // Normalize videoId by ensuring it starts with 'clip_'
    const normalizedVideoId = videoId.startsWith('clip_') ? videoId : `clip_${videoId}`;

    // Check in clips directory first (most likely location)
    const clipFiles = fs.readdirSync(clipsPath);
    
    // First try exact prefix match in clips
    let exactMatch = clipFiles.find(file =>
        file.startsWith(normalizedVideoId) &&
        ALLOWED_EXTENSIONS.includes(path.extname(file).toLowerCase())
    );
    
    if (exactMatch) {
        return { file: exactMatch, dir: clipsPath };
    }
    
    // Try to find by id anywhere in the filename in clips
    let partialMatch = clipFiles.find(file =>
        file.includes(videoId) &&
        ALLOWED_EXTENSIONS.includes(path.extname(file).toLowerCase())
    );
    
    if (partialMatch) {
        return { file: partialMatch, dir: clipsPath };
    }
    
    // If not found in clips, check recordings
    const recordingFiles = fs.readdirSync(recordingsPath);
    
    // Try exact prefix match in recordings
    exactMatch = recordingFiles.find(file =>
        file.startsWith(normalizedVideoId) &&
        ALLOWED_EXTENSIONS.includes(path.extname(file).toLowerCase())
    );
    
    if (exactMatch) {
        return { file: exactMatch, dir: recordingsPath };
    }
    
    // Try to find by id anywhere in the filename in recordings
    partialMatch = recordingFiles.find(file =>
        file.includes(videoId) &&
        ALLOWED_EXTENSIONS.includes(path.extname(file).toLowerCase())
    );
    
    if (partialMatch) {
        return { file: partialMatch, dir: recordingsPath };
    }

    logger.debug(`No video file found for ID: ${videoId}`);
    
    // Not found in either directory
    return null;
};

export function setupVideoProtocol() {
    logger.info('Setting up GCASP video protocol handler');
    // Ensure directories exist
    ensureDirectories();

    protocol.handle('gcasp', async (request) => {
        try {
            const requestUrl = new URL(request.url);
            const videoId = decodeURIComponent(requestUrl.hostname);

            // Enforce maximum title length
            const MAX_VIDEO_TITLE_LENGTH = 75;
            if (videoId.length > MAX_VIDEO_TITLE_LENGTH) {
                logger.error('Video title too long:', videoId);
                return new Response('Invalid request: video title too long', { status: 400 });
            }
            
            if (!videoId || !isSafeFilename(videoId)) {
                logger.error('Invalid or unsafe video ID requested:', videoId);
                return new Response('Invalid request', { status: 400 });
            }

            // Search for the video in both directories
            const videoInfo = findVideoFile(videoId);

            if (!videoInfo) {
                logger.error('Video file not found for ID:', videoId);
                return new Response('Video not found', { status: 404 });
            }

            const videoPath = path.join(videoInfo.dir, videoInfo.file);

            if (!isPathWithinDirectory(videoInfo.dir, videoPath)) {
                logger.error('Attempted directory traversal:', videoPath);
                return new Response('Access denied', { status: 403 });
            }

            const stats = await fs.promises.stat(videoPath);
            if (!stats.isFile()) {
                logger.error('Invalid file type for video:', videoPath);
                return new Response('Invalid file type', { status: 400 });
            }

            const fileSize = stats.size;
            const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB limit
            if (fileSize > MAX_FILE_SIZE) {
                logger.error(`File size ${fileSize} exceeds limit of ${MAX_FILE_SIZE}`);
                return new Response('File too large', { status: 413 });
            }

            const rangeHeader = request.headers.get('range');

            if (rangeHeader) {
                //logger.debug(`Range header provided: ${rangeHeader}`);
                // More robust range parsing
                const matches = rangeHeader.match(/bytes=(\d*)-(\d*)/);
                if (!matches) {
                    logger.warn('Invalid range format:', rangeHeader);
                    // Fall back to sending the whole file
                    const nodeStream = fs.createReadStream(videoPath);
                    const webStream = nodeStreamToWebStream(nodeStream);
                    return new Response(webStream, {
                        status: 200,
                        headers: {
                            'Content-Length': fileSize.toString(),
                            'Content-Type': 'video/mp4',
                            'Accept-Ranges': 'bytes'
                        }
                    });
                }
                
                let start = parseInt(matches[1], 10);
                let end = matches[2] ? parseInt(matches[2], 10) : undefined;
                
                // Handle missing or invalid start position
                if (isNaN(start)) {
                    start = 0;
                }
                
                // Handle missing or invalid end position
                if (isNaN(end) || end === 0) {
                    end = fileSize - 1;
                }
                
                // Ensure end doesn't exceed file size
                end = Math.min(end, fileSize - 1);
                
                // Make sure start is valid and within bounds
                start = Math.max(0, Math.min(start, end));
                
                const chunksize = end - start + 1;
                const headers = {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize.toString(),
                    'Content-Type': 'video/mp4', 
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                };

                //logger.debug(`Serving byte range: ${start}-${end}, chunk size: ${chunksize}`);
                const nodeStream = fs.createReadStream(videoPath, { start, end });
                const webStream = nodeStreamToWebStream(nodeStream);
                return new Response(webStream, { status: 206, headers });
            }

            logger.debug('No range header provided, serving full file');
            const nodeStream = fs.createReadStream(videoPath);
            const webStream = nodeStreamToWebStream(nodeStream);
            return new Response(webStream, {
                status: 200,
                headers: {
                    'Content-Length': fileSize.toString(),
                    'Content-Type': 'video/mp4',
                    'Accept-Ranges': 'bytes',
                    'Cache-Control': 'public, max-age=3600'
                }
            });
        } catch (error) {
            logger.error('Protocol handler error:', error);
            return new Response('Internal error', { status: 500 });
        }
    });
}