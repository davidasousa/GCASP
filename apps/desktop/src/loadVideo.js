import fs from 'fs';
import path from 'node:path';
import express from 'express';

export const loadMP4File = (filepath, server, port) => {
	// Serve video file
	filepath = path.resolve(__dirname,'../../', filepath);
	console.log(filepath);

	// Send File As Video
	server.get('/video', (req, res) => {
		if(!fs.existsSync(filepath)) {
			return res.status(404).send('Video Not Found');
		}
		res.setHeader('Content-Type', 'video/mp4');
		res.sendFile(filepath);
	});

	// Log To Console
	server.listen(port, () => {
		console.log(`Server running at http://localhost:${port}`);
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
    }, 1000); // Check every second
	});
}
 
