import fs from 'fs';
import path from 'node:path';
import express from 'express';
import chokidar from 'chokidar';

export async function loadMP4File(server) {
	// Server Side File Sending
	server.get(`/videos/:videoTimestamp`, async (req, res) => {
		const newpath = path.join(
			__dirname, 
			`../../currentVideos/output${req.params.videoTimestamp}.mp4`
		);
		fs.access(newpath, fs.constants.F_OK, (err) => {
			if (err) { res.status(404).send("Video Not Found"); }
			res.sendFile(newpath);
		});
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
	const videoPath = path.join(__dirname, '../../currentVideos');
	const watcher = chokidar.watch(videoPath, {
			persistent: true,
			ignoreInitial: true,
	});

	return watcher;
} 
