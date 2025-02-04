import { app, BrowserWindow, ipcMain } from 'electron'; // Added IPC Import
import path from 'node:path';
import started from 'electron-squirrel-startup';

// Getting Recorder Script
import { runRecord } from './recorder.js';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) { 
	app.quit(); 
}

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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Create The Display Window
  createWindow();

  // Listen For Record Message From Renderer Process
  ipcMain.handle('trigger-record', async () => {
		runRecord(); // Records Via Windows Binary
    return;
  });
	
	// Listen For Fetch Video Message
  ipcMain.handle('trigger-video-fetch', async () => {
		console.log("FETCH");
    return;
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
