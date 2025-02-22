import { spawn } from 'child_process';
import { app } from 'electron';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const recordingsPath = path.join(app.getPath('videos'), 'GCASP/recordings');

export const runRecord = (timestamp) => {
  return new Promise((resolve, reject) => {
		const outputPath = path.join(recordingsPath, `clip_${timestamp}.mp4`);

    const args = [
      '-y',
      '-f', 'gdigrab',
      '-i', 'desktop',
      '-t', '5',
			'-c:v', 'libx264',
			'-pix_fmt', 'yuv420p',
      outputPath
    ];

    const ffmpegProcess = spawn(process.env.FFMPEG_EXECUTABLE_NAME, args); 	
		
		/*
		ffmpegProcess.stdout.on('data', (data) => {
      console.log(`ffmpeg stdout: ${data}`);
    });

    ffmpegProcess.stderr.on('data', (data) => {
      console.error(`ffmpeg stderr: ${data}`);
    });

		*/
    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpegProcess.on('error', (error) => {
      reject(error);
    });
  });
};
