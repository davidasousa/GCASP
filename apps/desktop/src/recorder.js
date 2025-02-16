import { spawn } from 'child_process';
import path from 'node:path';

import dotenv from 'dotenv';
dotenv.config();

export const runRecord = (timestamp) => {
	
	const outputPath = path.join(
		'currentVideos', 
		`output${timestamp}.mp4`
	);

  const args = [
		'-y',
    '-f', 'gdigrab',
    '-i', 'desktop',
    '-t', '5',
    outputPath
  ];

  const ffmpegExecutable = process.env.FFMPEG_EXECUTABLE_NAME; 
  const ffmpegProcess = spawn(ffmpegExecutable, args);

  // Listen to stdout and stderr
  ffmpegProcess.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  // stdout data
  ffmpegProcess.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });
  // Listen for exit
  ffmpegProcess.on('close', (code) => {
    console.log(`FFmpeg process exited with code ${code}`);
  });

   // ffmpeg not found error
  ffmpegProcess.on('error', (error) => {
    console.error('Error spawning ffmpeg process:', error);
  });
};
