import { app } from 'electron';
import path from 'node:path';
import fs from 'fs';

const recordingsPath = path.join(app.getPath('videos'), 'GCASP/recordings');

export function ensureAppDirectories() {
  const userVideosPath = path.join(app.getPath('videos'), 'GCASP');
  
  if (!fs.existsSync(userVideosPath)) {
    fs.mkdirSync(userVideosPath, { recursive: true });
    console.log(`Created GCASP videos directory at: ${userVideosPath}`);
  }
}

export function getAppPaths() {
  return {
    videosPath: path.join(app.getPath('videos'), 'GCASP')
  };
}

export function deleteRecordings() {
	const files = fs.readdirSync(recordingsPath);
	files.filter(file => file.endsWith('.mp4'))
	.map(file => {
			const filePath = path.join(recordingsPath, file);
			fs.unlinkSync(filePath);  // Remove the file
			console.log(`Deleted: ${filePath}`);
	});
}

