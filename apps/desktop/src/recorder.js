import { spawn } from 'child_process';
import path from 'node:path';

const binaryFilePath = path.join(
	'windowsDependencies/ffmpegDir/bin',
	'ffmpeg.exe'
	);

const outputPath = path.join(
	'videos',
	'output.mp4'
	);

// Record Via Windows Binary
export const runRecord = () => {
  const args = [
    '-f', 'gdigrab',
    '-i', 'desktop',
		'-t', '2',
		outputPath
  ];

  const ffmpegProcess = spawn(binaryFilePath, args);
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
};
