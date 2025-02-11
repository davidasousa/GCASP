import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import fs from 'fs';

// Backend Server - File Transfer
import express from 'express';
import cors from 'cors';

// Getting Recorder Script
import { runRecord } from './recorder.js';
import { loadMP4File, isFileDone, createVideoWatcher } from './loadVideo.js';

// Starting Express Server For Backend Communication
const server = express();
server.use(cors());
const port = 3001;

/* Here Is Where The Actual Rendering Process Begins */
const watcher = createVideoWatcher();
var videoNum = 1;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) { app.quit(); }

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
  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  // Open the DevTools.
  mainWindow.webContents.openDevTools();

	// Monitor For Changes To The Videos Folder
	watcher.on('add', async (path) => {
		await isFileDone(path)
			.then(() => {
				mainWindow.webContents.send('trigger-new-video', path);
			});
	})
	
	// Starting Server
	server.listen(port, () => {
		console.log(`Server running at http://localhost:${port}`);
	});
};

app.whenReady().then(() => {
  // Create The Display Window
  createWindow();

	// Handeling IPC Requests
  ipcMain.handle('trigger-record', async (event, fileName) => {
		runRecord(videoNum++); // Records Via Windows Binary
    return;
  });	

	// Handle Video Fetch Requests
  ipcMain.handle('trigger-video-fetch', (event, filePath) => {
		// Load The Video & Send On Server
    loadMP4File(filePath, server);
		return;
  });
});

// Closing The Program
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
