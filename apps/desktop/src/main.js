// main.js
import { app, protocol, ipcMain, BrowserWindow } from 'electron';
import path from 'path';
import { net } from 'electron';
import fs from 'fs';
import { setupVideoProtocol } from './videoProtocol';
import { setupIpcHandlers } from './ipcHandlers';
import { ensureAppDirectories, deleteRecordings } from './utilities';

// Get user's videos directory
const recordingsPath = path.join(app.getPath('videos'), 'GCASP/recordings');

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
		// Deleting All Recordings
		const files = fs.readdirSync(recordingsPath);
		files.filter(file => file.endsWith('.mp4'))
		.map(file => {
				const filePath = path.join(recordingsPath, file);
				fs.unlinkSync(filePath);  // Remove the file
				console.log(`Deleted: ${filePath}`);
		});

	if (process.platform !== 'darwin') {
		app.quit();
	}
});
