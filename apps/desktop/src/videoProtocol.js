// videoProtocol.js
import { protocol, net, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { URL } from 'url';

const userVideosPath = path.join(app.getPath('videos'), 'GCASP');
const ALLOWED_EXTENSIONS = ['.mp4'];

const isPathWithinDirectory = (directory, targetPath) => {
const relative = path.relative(directory, targetPath);
return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
};

const isValidFilename = (filename) => {
const safeFilenameRegex = /^[a-zA-Z0-9-_]+(\.[a-zA-Z0-9]+)?$/;
return safeFilenameRegex.test(filename);
};

export function setupVideoProtocol() {
    if (!fs.existsSync(userVideosPath)) {
        fs.mkdirSync(userVideosPath, { recursive: true, mode: 0o700 });
    }

    protocol.handle('gcasp', async (request) => {
        try {
            // Validate request URL
            const requestUrl = new URL(request.url);
            const videoId = decodeURIComponent(requestUrl.hostname);

            if (!videoId || !isValidFilename(videoId)) {
                console.error('Invalid video ID requested:', videoId);
                return new Response('Invalid request', { status: 400 });
            }

            // Find matching video file
            const files = fs.readdirSync(userVideosPath);
            const videoFile = files.find(file => 
                file.startsWith(`clip_${videoId}`) && 
                ALLOWED_EXTENSIONS.includes(path.extname(file).toLowerCase())
            );

            if (!videoFile) {
                console.error('Video file not found:', videoId);
                return new Response('Video not found', { status: 404 });
            }

            const videoPath = path.join(userVideosPath, videoFile);

            // Security checks
            if (!isPathWithinDirectory(userVideosPath, videoPath)) {
                console.error('Attempted directory traversal:', videoPath);
                return new Response('Access denied', { status: 403 });
            }

            // Get file stats
            const stats = await fs.promises.stat(videoPath);
            if (!stats.isFile()) {
                return new Response('Invalid file type', { status: 400 });
            }

            const fileSize = stats.size;
            const rangeHeader = request.headers.get('range');

            if (rangeHeader) {
                const parts = rangeHeader.replace(/bytes=/, '').split('-');
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

                if (start >= fileSize || end >= fileSize || start > end) {
                return new Response('Requested range not satisfiable', {
                    status: 416,
                    headers: {
                    'Content-Range': `bytes */${fileSize}`
                    }
                });
                }

                const chunksize = end - start + 1;
                const headers = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize.toString(),
                'Content-Type': 'video/mp4'
                };

                // Create a new response with 206 Partial Content status
                return new Response(
                fs.createReadStream(videoPath, { start, end }), 
                { 
                    status: 206, 
                    headers
                }
                );
            }

            // Full file response
            return new Response(
                fs.createReadStream(videoPath),
                {
                status: 200,
                headers: {
                    'Content-Length': fileSize.toString(),
                    'Content-Type': 'video/mp4',
                    'Accept-Ranges': 'bytes'
                }
                }
            );

        } catch (error) {
            console.error('Protocol handler error:', error);
            return new Response('Internal error', { status: 500 });
        }
    });
}