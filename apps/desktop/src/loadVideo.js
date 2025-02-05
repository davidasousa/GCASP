import fs from 'fs';
import path from 'node:path';

export const loadMP4File = (req, res, path) => {
	try {
			const videoBuffer = fs.readFileSync(path);
			const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' });
			return videoBlob;
		} catch (error) {
			console.error('Error loading video:', error);
			throw new Error('Failed to load video');
		}
}
