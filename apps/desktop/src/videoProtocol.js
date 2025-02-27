import { protocol, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { URL } from 'url';

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
        fs.mkdirSync(recordingsPath, { recursive: true, mode: 0o700 });
    }
    if (!fs.existsSync(clipsPath)) {
        fs.mkdirSync(clipsPath, { recursive: true, mode: 0o700 });
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
        return false;
    }
    
    // Block filenames with null bytes or control characters
    if (/[\x00-\x1f]/.test(filename)) {
        return false;
    }
    
    // Otherwise allow more flexible naming
    return true;
};

// Find video in either directory
const findVideoFile = (videoId) => {
    // Check in clips directory first (most likely location)
    const clipFiles = fs.readdirSync(clipsPath);
    
    // First try exact prefix match in clips
    let exactMatch = clipFiles.find(file => 
        file.startsWith(`clip_${videoId}`) && 
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
        file.startsWith(`clip_${videoId}`) && 
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
    
    // Not found in either directory
    return null;
};

export function setupVideoProtocol() {
    // Ensure directories exist
    ensureDirectories();

    protocol.handle('gcasp', async (request) => {
        try {
            const requestUrl = new URL(request.url);
            const videoId = decodeURIComponent(requestUrl.hostname);

            if (!videoId || !isSafeFilename(videoId)) {
                console.error('Invalid or unsafe video ID requested:', videoId);
                return new Response('Invalid request', { status: 400 });
            }

            // Search for the video in both directories
            const videoInfo = findVideoFile(videoId);

            if (!videoInfo) {
                console.error('Video file not found for ID:', videoId);
                return new Response('Video not found', { status: 404 });
            }

            const videoPath = path.join(videoInfo.dir, videoInfo.file);

            if (!isPathWithinDirectory(videoInfo.dir, videoPath)) {
                console.error('Attempted directory traversal:', videoPath);
                return new Response('Access denied', { status: 403 });
            }

            const stats = await fs.promises.stat(videoPath);
            if (!stats.isFile()) {
                return new Response('Invalid file type', { status: 400 });
            }

            const fileSize = stats.size;
            const rangeHeader = request.headers.get('range');

            if (rangeHeader) {
                // More robust range parsing
                const matches = rangeHeader.match(/bytes=(\d*)-(\d*)/);
                if (!matches) {
                    console.log('Invalid range format:', rangeHeader);
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

                const nodeStream = fs.createReadStream(videoPath, { start, end });
                const webStream = nodeStreamToWebStream(nodeStream);
                return new Response(webStream, { status: 206, headers });
            }

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
            console.error('Protocol handler error:', error);
            return new Response('Internal error', { status: 500 });
        }
    });
}