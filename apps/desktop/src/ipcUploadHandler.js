import { ipcMain } from 'electron';
import { getModuleLogger } from './logger';
import { app } from 'electron';
import axios from 'axios';  // Correct import for axios
import FormData from 'form-data';
import path from 'path';
import fs from 'fs';

const logger = getModuleLogger('ipcSettingsHandlers.js');

const DEFAULT_API_URL = 'http://localhost:5001';

// Helper to get API URL
const getApiUrl = () => {
  return process.env.API_URL || DEFAULT_API_URL;
};

// Taken From videoProtocal.js
const findClip = (videoTitle) => {
  const clipsPath = path.join(app.getPath('videos'), 'GCASP/clips');
  const clipFiles = fs.readdirSync(clipsPath);
  const match = clipFiles.find(file => file === videoTitle);

  if (match) {
    return path.join(clipsPath, match); // full path
  } else {
    return null;
  }
};

async function uploadClipFile(file, title, token) {
    const form = new FormData();
  
    // Append the video file (use the file's name as the filename)
    form.append("video", fs.createReadStream(file), {
      filename: path.basename(file), // Keep the original filename
      contentType: "video/mp4", // Assuming the video is in mp4 format (change accordingly)
    });
  
    // Append the title
    form.append("title", title);
  
    try {
      // Send the POST request with the form data
      const response = await axios.post(`${getApiUrl()}/videos/upload`, form, {
            headers: {
            ...form.getHeaders(), // Automatically sets content-type and boundary
            Authorization: `Bearer ${token}`, // Bearer token for authorization
            },
            timeout: 10000, // 10-second timeout
      });
  
        console.log("Upload successful:", response.data);
    } catch (error) {
        console.error("Upload failed:", error.response?.data || error.message);
    }
}
  

// Initialize settings and register handlers
export function setupUploadHandlers() {
  logger.debug("Setting Up Upload Handlers");
  // Trigger Upload Clip
  logger.debug("Registering Upload");
  ipcMain.handle('trigger-upload-clip', async (event, title, token) => {
    logger.debug('Uploading Clip');
    const clip = findClip(title);

    try {
      const response = await uploadClipFile(clip, title, token);
      return response;
    } catch (error) {
      logger.error('Upload failed:', error.message);
      return { message: 'Upload failed' };
    }
  });
}

export default setupUploadHandlers;
