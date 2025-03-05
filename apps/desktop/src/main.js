// main.js
import { app, protocol, ipcMain, BrowserWindow } from 'electron';
import path from 'path';
import { net } from 'electron';
import fs from 'fs';
import { setupVideoProtocol } from './videoProtocol';
import { setupIpcHandlers, cleanupIpcHandlers } from './ipcHandlers';
import { ensureAppDirectories, deleteRecordings } from './utilities';
import { stopContinuousRecording } from './recorder';

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

	// Setup IPC handlers (this will also start the continuous recording)
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

// Safely delete recordings with error handling
function safelyDeleteRecordings() {
	try {
		const files = fs.readdirSync(recordingsPath);
		files.filter(file => file.endsWith('.mp4'))
		.forEach(file => {
			try {
				const filePath = path.join(recordingsPath, file);
				fs.unlinkSync(filePath);
				console.log(`Deleted: ${filePath}`);
			} catch (err) {
				// Ignore errors when deleting individual files
				console.log(`Could not delete file: ${file} - ${err.message}`);
			}
		});
	} catch (err) {
		console.error('Error during cleanup:', err);
	}
}

app.on('window-all-closed', () => {
	// Stop continuous recording when app closes
	stopContinuousRecording();
	
	// Cleanup IPC handlers (including hotkeys)
	cleanupIpcHandlers();
	
	// Wait a bit for FFmpeg to fully release file handles
	setTimeout(() => {
		safelyDeleteRecordings();
		
		if (process.platform !== 'darwin') {
			app.quit();
		}
	}, 500); // 500ms delay should be enough
});

// Make sure recording is stopped before the app quits
app.on('before-quit', () => {
	stopContinuousRecording();
	cleanupIpcHandlers();
});