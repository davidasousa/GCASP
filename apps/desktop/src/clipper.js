import { useEffect } from 'react';

export class clipSettings {
	constructor(length) {
		this.length = length;
	}
}

const handleRecord = async () => {
	console.log("Start");
	try { await window.electron.triggerRecordVideo(); } 
	catch (error) { console.error('Error starting recording:', error); }
};

export const clipper = async () => {
	var clipWindow = [];

	// Storing LRU Videos
	useEffect(() => {
		const handleNewRecording = async (videoInfo) => {
			clipWindow.push(videoInfo);
			
			if(clipWindow.length > 5) {
				throw new Error("Clip Window Length Exceeded");
			} else if(clipWindow.length == 5) {
				const file = clipWindow[0].filename;
				await window.electron.removeSpecificVideo(file); 
				clipWindow.shift();
				await handleRecord();
			} else {
				await handleRecord();
			}
		}
		
		window.electron.onRecordingDone(handleNewRecording); 
	}, []);
}
