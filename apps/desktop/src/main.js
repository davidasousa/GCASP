import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import fs from 'fs';
import { spawn } from 'node:child_process';
// Backend Server - File Transfer
import express from 'express';
import cors from 'cors';

import { runRecord } from './recorder';
import { loadMP4File } from './serverSideReq'; 
import { isFileDone, createVideoWatcher, getTimestamp } from './utilities';

// Starting Express Server For Backend Communication
const server = express();
const port = 4000;
server.use(cors());

// Creating File Watcher
const watcher = createVideoWatcher();

/* 
 * Here Is Where The Actual Rendering Process Begins 
 */

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) { app.quit(); }

let timestamp = null;

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.webContents.openDevTools();

	// Monitor For Changes To The Videos Folder
	watcher.on('add', async (path) => {
		await isFileDone(path)
			.then(() => {
				mainWindow.webContents.send('trigger-new-video', timestamp);
			});
	})
	
	// Starting Server
	server.listen(port, () => {
		console.log(`Server running at http://localhost:${port}`);
	});
};

// App Rendering Cycle
app.whenReady().then(() => {
  // Create The Display Window
  createWindow();

	// Handle Invoke Record
  ipcMain.handle('trigger-record', (event) => {
		timestamp = getTimestamp();
		runRecord(timestamp);
    return;
  });	

	// Handle Video Fetch Requests From Client
  ipcMain.handle('trigger-recording-fetch', (event) => {
    loadMP4File(server);
		return;
  });
	
	// Handle Fetch All Previous Videos
	ipcMain.handle('trigger-fetch-prev-videos', (event) => {
		return;
	})

});


// Closing The Program
app.on('window-all-closed', () => {
	const srcDir = path.join(__dirname, '../../currentVideos');
	const dstDir = path.join(__dirname, '../../prevVideos');

	fs.readdir(srcDir, (err, files) => {
		files.forEach((file) => {
			const srcFilePath = path.join(srcDir, file);
			const dstFilePath = path.join(dstDir, file);

			fs.rename(srcFilePath, dstFilePath, (err) => {
				if(err) {
					console.error(`Error moving file ${file}:`, err);
				} else {
					console.log(`Moved file: ${file}`);
				}
			});
		});
	});

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
