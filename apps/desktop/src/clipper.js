import { useEffect } from 'react';

export class clipSettings {
	constructor(length) {
		this.length = length;
	}
}

export const clipper = async () => {
	var clipWindow = [];

	// Storing LRU Videos
	useEffect(() => {
		const handleNewRecording = async (videoInfo) => {
			clipWindow.push(videoInfo)
			if(clipWindow.length > 5) {
				throw new Error("Clip Window Length Exceeded");
			}
			if(clipWindow.length == 5) {
				// Removing The Old File
				const file = clipWindow[0].filename;
				await window.electron.removeSpecificVideo(file); 
				clipWindow.shift();
			}
		}
		
		// Sends The Video Info
		window.electron.onNewRecording(handleNewRecording); 
	}, []);
}
