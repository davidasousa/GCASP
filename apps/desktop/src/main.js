// main.js
import { app, protocol, ipcMain, BrowserWindow } from 'electron';
import path from 'path';
import { net } from 'electron';
import fs from 'fs';
import { setupVideoProtocol } from './videoProtocol';
import { setupIpcHandlers, cleanupIpcHandlers } from './ipcHandlers';
import { ensureAppDirectories, deleteRecordings } from './utilities';
import { stopContinuousRecording } from './recorder';
import logger from './logger';

// Get user's videos directory
const recordingsPath = path.join(app.getPath('videos'), 'GCASP/recordings');
logger.info(`Starting GCASP application`);
logger.info(`Recordings path: ${recordingsPath}`);

// Register gcasp:// as a secure protocol
logger.debug('Registering gcasp:// protocol...');
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
logger.debug('Protocol registration completed');

app.whenReady().then(() => {
	logger.info('Electron app ready, initializing...');
	
	// Ensure directories exist
	logger.debug('Ensuring application directories exist...');
	ensureAppDirectories();
	logger.debug('Application directories created/verified');

	// Setup protocol handler
	logger.debug('Setting up video protocol handler...');
	setupVideoProtocol();
	logger.debug('Video protocol handler configured');

	// Setup renderer process logging
	logger.debug('Setting up renderer process logging via IPC...');
	
	try {
		setupRendererLogging(ipcMain);
		logger.debug('Renderer process logging configured successfully');
	} catch (error) {
		logger.error('Failed to set up renderer logging:', error);
	}
	
	// Setup IPC handlers (this will also start the continuous recording)
	logger.debug('Setting up IPC handlers and starting continuous recording...');
	setupIpcHandlers();
	logger.info('IPC handlers configured and continuous recording started');

	// Create the main window
	logger.debug('Creating main application window...');
	const mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
		}
	});
	
	mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
		logger.error('Failed to load page in main window', { 
			errorCode, 
			errorDescription 
		});
	});
	
	mainWindow.webContents.on('crashed', (event) => {
		logger.error('Main window renderer process crashed');
	});
	
	mainWindow.webContents.on('render-process-gone', (event, details) => {
		logger.error('Renderer process gone', { 
			reason: details.reason, 
			exitCode: details.exitCode 
		});
	});

	logger.debug(`Loading main window URL: ${MAIN_WINDOW_WEBPACK_ENTRY}`);
	mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY)
		.then(() => {
			logger.info('Main window loaded successfully');
		})
		.catch((error) => {
			logger.error('Error loading main window URL', { error: error.message });
		});
	
	logger.info('Application startup complete');
});

// Safely delete recordings with error handling
export function safelyDeleteRecordings() {
	logger.debug('Starting cleanup of recording files...');
	try {
		if (!fs.existsSync(recordingsPath)) {
			logger.warn(`Recordings path doesn't exist: ${recordingsPath}`);
			return;
		}
		
		const files = fs.readdirSync(recordingsPath);
		logger.debug(`Found ${files.length} files in recordings directory`);
		
		const videoFiles = files.filter(file => file.endsWith('.mp4'));
		logger.debug(`Found ${videoFiles.length} .mp4 files to delete`);
		
		videoFiles.forEach(file => {
			try {
				const filePath = path.join(recordingsPath, file);
				fs.unlinkSync(filePath);
				logger.debug(`Deleted recording: ${filePath}`);
			} catch (err) {
				// Ignore errors when deleting individual files
				logger.warn(`Could not delete file: ${file}`, { error: err.message });
			}
		});
		logger.info(`Deleted ${videoFiles.length} recording files`);
	} catch (err) {
		logger.error('Error during recordings cleanup:', err);
	}
}

// Application event handlers
app.on('window-all-closed', () => {
	logger.info('All windows closed, preparing to shut down...');
	
	// Stop continuous recording when app closes
	logger.debug('Stopping continuous recording...');
	stopContinuousRecording();
	logger.debug('Continuous recording stopped');
	
	// Cleanup IPC handlers (including hotkeys)
	logger.debug('Cleaning up IPC handlers and hotkeys...');
	cleanupIpcHandlers();
	logger.debug('IPC handlers and hotkeys cleaned up');
	
	// Wait a bit for FFmpeg to fully release file handles
	logger.debug('Waiting for file handles to be released before final cleanup...');
	setTimeout(() => {
		logger.debug('Performing final cleanup...');
		safelyDeleteRecordings();
		
		logger.info('Application quitting...');
		app.quit();

	}, 500);
});

app.on('browser-window-created', (event, window) => {
	logger.debug('New browser window created', { windowId: window.id });
});

app.on('render-process-gone', (event, webContents, details) => {
	logger.error('Render process gone', { reason: details.reason, exitCode: details.exitCode });
});

// Make sure recording is stopped before the app quits
app.on('before-quit', () => {
	logger.info('Application quit requested...');
	
	logger.debug('Stopping continuous recording before quit...');
	stopContinuousRecording();
	logger.debug('Continuous recording stopped before quit');
	
	logger.debug('Cleaning up IPC handlers before quit...');
	cleanupIpcHandlers();
	logger.debug('IPC handlers cleaned up before quit');
	
	logger.info('Application ready to quit');
});

// Handle unhandled errors and rejections
process.on('uncaughtException', (error) => {
	logger.error('Uncaught exception in main process:', error);
});

process.on('unhandledRejection', (reason, promise) => {
	logger.error('Unhandled promise rejection in main process:', { reason, promise });
});