import { spawn } from 'child_process';
import path from 'node:path';

const filePath = path.join(
	'windowsDependencies/ffmpegDir/bin',
	'ffmpeg.exe'
	);

export const runBinary = () => {
  const args = [
    '-f', 'gdigrab',
    '-i', 'desktop',
		'-t', '2',
    'output.mp4'
  ];

  const ffmpegProcess = spawn(filePath, args);

  // Listen to stdout and stderr
  ffmpegProcess.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  ffmpegProcess.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  // Listen for exit
  ffmpegProcess.on('close', (code) => {
    console.log(`FFmpeg process exited with code ${code}`);
  });
};
