// Frontend Source File For Clipping Raw Recordings
const ffmpegPath = 'windowsDependencies/ffmpegDir/bin/ffmpeg.exe';
const { spawn } = require('child_process');

// Defining Recording Object Function
const createClipper = function() {
	const args = [
		'-t', '2',
		'-f', 'gdigrab',
		'-i', 'desktop',
		'-framerate', '25',
		'-video_size', '640x480',
		'output.mp4'
	];
	const ffmpeg = spawn(ffmpegPath, args);	
};

// Defining Exports
exports.createClipper = createClipper;
