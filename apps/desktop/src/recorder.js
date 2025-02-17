import { spawn } from 'child_process';
import { app } from 'electron';
import path from 'path';

export const runRecord = (timestamp) => {
  return new Promise((resolve, reject) => {
    const userVideosPath = path.join(app.getPath('videos'), 'GCASP');
    const outputPath = path.join(userVideosPath, `clip_${timestamp}.mp4`);

    const args = [
      '-y',
      '-f', 'gdigrab',
      '-i', 'desktop',
      '-t', '5',
      outputPath
    ];

    const ffmpegProcess = spawn('ffmpeg', args);
    
    ffmpegProcess.stdout.on('data', (data) => {
      console.log(`ffmpeg stdout: ${data}`);
    });

    ffmpegProcess.stderr.on('data', (data) => {
      console.error(`ffmpeg stderr: ${data}`);
    });

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