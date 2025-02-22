import { useEffect } from 'react';
import { EventEmitter } from 'events';

export class clipper {
constructor(_clipLength) {
	this.clipLength = _clipLength;
	this.clipWindow = [];
	// Event Listener
	this.captureListener = new EventEmitter();
	this.setupEventListeners();

	// Calling The First Record
	this.handleRecord();
}

setupEventListeners() {
	this.captureListener.once('capture-clip', async () => {
		await window.electron.triggerClipVideo(this.clipLength);
	});
}

// Trigger The Recording Of The Next Video
async handleRecord() {
	try { await window.electron.triggerRecordVideo(); } 
	catch (error) { console.error('Error starting recording:', error); }
};

// Setting The Clip Request Flag
sendClipRequest() { this.captureListener.emit('capture-clip'); };

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

}
