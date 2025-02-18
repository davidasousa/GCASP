// main.js
import { app, protocol, ipcMain, BrowserWindow } from 'electron';
import path from 'path';
import { net } from 'electron';
import fs from 'fs';
import { setupVideoProtocol } from './videoProtocol';
import { setupIpcHandlers } from './ipcHandlers';
import { ensureAppDirectories } from './utilities';

// Get user's videos directory
const userVideosPath = path.join(app.getPath('videos'), 'GCASP');

// Register gcasp:// as a secure protocol
protocol.registerSchemesAsPrivileged([
{
	scheme: 'gcasp',
	privileges: {
	standard: true,
	secure: true,
	supportFetchAPI: true,
	stream: true
	}
}
]);

app.whenReady().then(() => {
	// Ensure directories exist
	ensureAppDirectories();

	// Setup protocol handler
	setupVideoProtocol();

	// Setup IPC handlers
	setupIpcHandlers();

	// Create the main window
	const mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
		nodeIntegration: false,
		contextIsolation: true,
		preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
		}
	});

	mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
	});

	app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});
