import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import fs from 'fs';
// Backend Server - File Transfer
import express from 'express';
import cors from 'cors';
// Directory Monitoring
import chokidar from 'chokidar';

// Getting Recorder Script
import { runRecord } from './recorder.js';
import { loadMP4File, isFileDone } from './loadVideo.js';

// Starting Express Server For Backend Communication
const server = express();
const fileTransferPort = 3001; // Configured In Forge Config JS File
server.use(cors()); // For Sending & Transfer With Multiple Ports

// Importing File Monitoring
const videoPath = path.join(__dirname, '../../videos'); // Directory Being Watched
const watcher = chokidar.watch(videoPath, {
		persistent: true,
		ignoreInitial: true,
});

/* 
 * Here Is Where The Actual Rendering Process Begins
 */

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
	watcher.on('add', async (filePath) => {
		await isFileDone(filePath)
			.then(() => {
				mainWindow.webContents.send('trigger-new-video', filePath);
			});
	})
};

app.whenReady().then(() => {
  // Create The Display Window
  createWindow();

	// Handeling IPC Requests
  ipcMain.handle('trigger-record', async (event, fileName) => {
		runRecord(); // Records Via Windows Binary
    return;
  });	

	// Handle Video Fetch Requests
  ipcMain.handle('trigger-video-fetch', (event, filePath) => {
		// Load The Video & Send On Server
    loadMP4File(filePath, server, fileTransferPort);
		return;
  });
});

// Closing The Program
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
