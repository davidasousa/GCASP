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

const userVideosPath = path.join(app.getPath('videos'), 'GCASP');
const ALLOWED_EXTENSIONS = ['.mp4'];

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

// Find the video file by id (more flexible matching)
const findVideoFile = (videoId) => {
    const files = fs.readdirSync(userVideosPath);
    
    // First try exact prefix match
    const exactMatch = files.find(file => 
        file.startsWith(`clip_${videoId}`) && 
        ALLOWED_EXTENSIONS.includes(path.extname(file).toLowerCase())
    );
    
    if (exactMatch) {
        return exactMatch;
    }
    
    // If no exact match, try to find by id anywhere in the filename
    return files.find(file => 
        file.includes(videoId) && 
        ALLOWED_EXTENSIONS.includes(path.extname(file).toLowerCase())
    );
};

export function setupVideoProtocol() {
    if (!fs.existsSync(userVideosPath)) {
        fs.mkdirSync(userVideosPath, { recursive: true, mode: 0o700 });
    }

    protocol.handle('gcasp', async (request) => {
        try {
            const requestUrl = new URL(request.url);
            const videoId = decodeURIComponent(requestUrl.hostname);

            if (!videoId || !isSafeFilename(videoId)) {
                console.error('Invalid or unsafe video ID requested:', videoId);
                return new Response('Invalid request', { status: 400 });
            }

            const videoFile = findVideoFile(videoId);

            if (!videoFile) {
                console.error('Video file not found for ID:', videoId);
                return new Response('Video not found', { status: 404 });
            }

            const videoPath = path.join(userVideosPath, videoFile);

            if (!isPathWithinDirectory(userVideosPath, videoPath)) {
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
                
                //console.log(`Range request: bytes=${start}-${end}/${fileSize}`);
                
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