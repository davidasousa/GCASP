import { useEffect } from 'react';

export class clipper {
constructor(_clipLength) {
	this.clipLength = length;
	this.clipWindow = [];
	this.captureFlag = false;

	// Calling The First Record
	this.handleRecord();
}

async runClipper() {
		useEffect(() => {
		const handleNewRecording = async (videoInfo) => {
			this.clipWindow.push(videoInfo);

			if(this.clipWindow.length > 5) {
				throw new Error("Clip Window Length Exceeded");
			} else if(this.clipWindow.length == 5) {
				const file = this.clipWindow[0].filename;
				await window.electron.removeSpecificVideo(file);
				this.clipWindow.shift();
			}

			await this.handleRecord();
		}

		window.electron.onRecordingDone(handleNewRecording);
	}, []);
};

// Trigger The Recording Of The Next Video
async handleRecord() {
	try { await window.electron.triggerRecordVideo(); } 
	catch (error) { console.error('Error starting recording:', error); }
};
}
