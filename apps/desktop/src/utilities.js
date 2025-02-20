import { app } from 'electron';
import path from 'node:path';
import fs from 'fs';

const recordingsPath = path.join(app.getPath('videos'), 'GCASP/recordings');

export function ensureAppDirectories() {
  if (!fs.existsSync(recordingsPath)) {
    fs.mkdirSync(recordingsPath, { recursive: true });
    console.log(`Created GCASP videos directory at: ${recordingsPath}`);
  }
}

export function getAppPaths() {
  return {
    videosPath: path.join(app.getPath('videos'), 'GCASP')
  };
}
