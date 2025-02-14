import fs from 'fs';
import path from 'node:path';
import express from 'express';
import chokidar from 'chokidar';

export async function loadMP4File(_path, server) {
	server.get(`/video/:videoID`, async (req, res) => {
		try {
			const newpath = path.join(__dirname, `../../videos/output${req.params.videoID}.mp4`);
			console.log(newpath);
			// await fs.access(newpath);
			res.sendFile(newpath);
		} catch (error) {
			res.status(404).send("Video Not Found");
		}

	});
}

// Helper Function To Check If A File Is Done Being Written By FFMPEG
export function isFileDone(filePath) {
  return new Promise((resolve, reject) => {
    let previousSize = -1;
    // Check file size every second
    const checkInterval = setInterval(() => {
      fs.stat(filePath, (err, stats) => {
        if (err) {
          clearInterval(checkInterval);
          return reject(err);
        }
        const currentSize = stats.size;
        // If the file size hasn't changed, assume it's done
        if (currentSize === previousSize) {
          clearInterval(checkInterval); // Stop checking
          resolve(); // File is done being written
        }
        previousSize = currentSize;
      });
    }, 1000);
	});
}

// Video Directory Watcher
export function createVideoWatcher() {
	const videoPath = path.join(__dirname, '../../videos');
	const watcher = chokidar.watch(videoPath, {
			persistent: true,
			ignoreInitial: true,
	});

	return watcher;
} 
