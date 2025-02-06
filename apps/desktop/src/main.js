import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import fs from 'fs';

// Backend Server
import express from 'express';
import cors from 'cors';

// Getting Recorder Script
import { runRecord } from './recorder.js';
import { loadMP4File, isFileDone } from './loadVideo.js';

// Starting Express Server For Backend Communication
const server = express();
const fileTransferPort = 3001; // Configured In Forge Config JS File
server.use(cors()); // For Sending & Transfer With Multiple Ports

// Importing File Monitoring
import chokidar from 'chokidar';
const videoPath = path.join(__dirname, '../../videos');
const watcher = chokidar.watch(videoPath, {
		persistent: true,
		ignoreInitial: true,
});

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
};

app.whenReady().then(() => {
  // Create The Display Window
  createWindow();

	// Handeling IPC Requests
  ipcMain.handle('trigger-record', async () => {
		runRecord(); // Records Via Windows Binary
    return;
  });	

  ipcMain.handle('trigger-video-fetch', (event, filePath) => {
    loadMP4File(filePath, server, fileTransferPort);
		return;
  });

	// Monitor For Changes To The Videos Folder
	watcher
	.on('add', filePath => {
		console.log('File Created');
		isFileDone(filePath)
			.then(() => {
				console.log('File Done Writing');
			})
	})

});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
