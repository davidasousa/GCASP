import fs from 'fs';
import path from 'node:path';

export const loadMP4File = (path) => {
	try {
			const videoBuffer = fs.readFileSync(path);
			const videoBlob = Buffer.from(videoBuffer); // Convert to a usable buffer
			return videoBlob;
		} catch (error) {
			console.error('Error loading video:', error);
			throw new Error('Failed to load video');
		}
}
