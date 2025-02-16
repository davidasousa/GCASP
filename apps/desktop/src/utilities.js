import path from 'node:path';
import fs from 'fs';
import chokidar from 'chokidar';

// Video Directory Watcher
export function createVideoWatcher() {
	const videoPath = path.join(__dirname, '../../currentVideos');
	const watcher = chokidar.watch(videoPath, {
			persistent: true,
			ignoreInitial: true,
	});

	return watcher;
} 

// Check If A File Is Done Being Written By FFMPEG
export function isFileDone(filePath) {
  return new Promise((resolve, reject) => {
    let previousSize = -1;
    let unchangedCount = 0;
    const maxUnchangedCount = 3;

    const timeout = setTimeout(() => reject(new Error('File check timeout exceeded.')), 30000);
    const checkInterval = setInterval(() => {
      fs.stat(filePath, (err, stats) => {
        if (err) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          return reject(err);
        }

        const currentSize = stats.size;
        if (currentSize === previousSize) {
          unchangedCount++;
          if (unchangedCount >= maxUnchangedCount) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            resolve();
          }
        } else {
          unchangedCount = 0;
        }

        previousSize = currentSize;
      });
    }, 1000);
  });
}

// Get Time Stamp
export function getTimestamp() {
	const now = new Date();

	const timestamp = now.getFullYear() + '-' 
    + String(now.getMonth() + 1).padStart(2, '0') + '-' 
    + String(now.getDate()).padStart(2, '0') + '-' 
    + String(now.getHours()).padStart(2, '0') + '-' 
    + String(now.getMinutes()).padStart(2, '0') + '-' 
    + String(now.getSeconds()).padStart(2, '0');

	return timestamp;
}
