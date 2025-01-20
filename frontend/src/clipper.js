// Frontend Source File For Clipping Raw Recordings
const ffmpeg = require('fluent-ffmpeg');

// Defining Recording Object Function
const createClipper = function() {
	// Specifying Input
	const recording = ffmpeg()
		.input(':0.0')
		.inputFormat('x11grab')
		.audioBitrate('128k')
		.fps(30)
		.size('640x480')
		.output('output.mp4')
		.duration('5')
		.on('start', () => {
			console.log('Recording started...')
		  })
		  .on('end', () => {
			console.log('Recording finished.')
		  })
		  .on('error', (err) => {
			console.error('Error:', err.message)
		  })
	
	recording.run(); // Starts the recording process
};

// Defining Exports
exports.createClipper = createClipper;
