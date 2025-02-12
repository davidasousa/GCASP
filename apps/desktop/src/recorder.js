import { spawn } from 'child_process';
import path from 'node:path';

const outputPath = path.join('videos', 'output.mp4');

export const runRecord = () => {

  const args = [
    '-f', 'gdigrab',
    '-i', 'desktop',
    '-t', '2',
    outputPath
  ];

  const ffmpegExecutable = 'ffmpeg'; 
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
