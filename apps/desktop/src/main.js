import { app, protocol, ipcMain, BrowserWindow, Menu, Tray, nativeImage, dialog } from 'electron';
import path from 'path';
import { net } from 'electron';
import fs from 'fs';
import { setupVideoProtocol } from './videoProtocol';
import { setupIpcHandlers, cleanupIpcHandlers } from './ipcHandlers';
import { setupAuthIpcHandlers } from './ipcAuthHandlers';
import { ensureAppDirectories, deleteRecordings } from './utilities';
import { stopContinuousRecording } from './recorder';
import { setupRendererLogging, getModuleLogger } from './logger';
import { getCurrentSettings } from './settings';
import { spawn } from 'child_process';
import { setupUploadHandlers } from './ipcUploadHandler';

const logger = getModuleLogger('main.js');

// Get user's videos directory
const recordingsPath = path.join(app.getPath('videos'), 'GCASP/recordings');
logger.info(`Starting GCASP application`);
logger.info(`Recordings path: ${recordingsPath}`);

// Global references to prevent garbage collection
let mainWindow = null;
let tray = null;
let forceQuit = false;

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

// Set up renderer logging IPC handler first, before any other IPC setup
function setupLogging() {
	logger.debug('Setting up renderer process logging via IPC...');
	try {
		// Set up renderer process logging
		setupRendererLogging(ipcMain);
		logger.debug('Renderer process logging configured successfully');
		return true;
	} catch (error) {
		logger.error('Failed to set up renderer logging:', error);
		return false;
	}
}

// Create tray icon and menu
function createTray() {
	logger.debug('Creating tray icon...');
	
	try {
		// Find the icon path - in a packaged app this path is different
		// We try to handle both development and production scenarios
		const iconPath = path.join(app.getAppPath(), 'src', 'resources', 'gcasp-trayicon-logo.png');
		logger.debug(`Using tray icon from: ${iconPath}`);
		
		// Create tray instance
		tray = new Tray(iconPath);
		tray.setToolTip('GCASP - Gaming Capture Application & Social Platform');
		
		// Create tray menu
		const contextMenu = Menu.buildFromTemplate([
			{
				label: 'Open GCASP',
				click: () => {
					logger.debug('Tray: Open GCASP clicked');
					if (mainWindow) {
						mainWindow.show();
					}
				}
			},
			{ type: 'separator' },
			{
				label: 'Exit',
				click: () => {
					logger.debug('Tray: Exit clicked');
					forceQuit = true;
					app.quit();
				}
			}
		]);
		
		tray.setContextMenu(contextMenu);
		
		// Add single-click handler to open app directly when clicking icon
		tray.on('click', () => {
			logger.debug('Tray icon clicked');
			if (mainWindow) {
				mainWindow.show();
			}
		});
		
		logger.info('Tray icon created successfully');
		return true;
	} catch (error) {
		logger.error('Failed to create tray icon:', error);
		return false;
	}
}

// Check if FFmpeg is installed and available in PATH
function checkFFmpegInstalled() {
	return new Promise((resolve) => {
		const ffmpeg = spawn('ffmpeg', ['-version']);
		ffmpeg.on('error', () => {
		// FFmpeg not found
		resolve(false);
		});
		ffmpeg.on('close', (code) => {
			// FFmpeg found if exit code is 0
			resolve(code === 0);
		});
	});
}

app.whenReady().then(async() => {

	const ffmpegInstalled = await checkFFmpegInstalled();

	if (!ffmpegInstalled) {
		// Show a dialog informing the user that FFmpeg is required
		dialog.showMessageBox({
			type: 'warning',
			title: 'FFmpeg Not Found',
			message: 'FFmpeg is required for video recording and editing.',
			detail: 'Please install FFmpeg and make sure it is available in your system PATH. You can download FFmpeg from https://ffmpeg.org/download.html',
			buttons: ['OK']
		});
	}

	logger.info('Electron app ready, initializing...');
	
	// Ensure directories exist
	logger.debug('Ensuring application directories exist...');
	ensureAppDirectories();
	logger.debug('Application directories created/verified');

	// Setup protocol handler
	logger.debug('Setting up video protocol handler...');
	setupVideoProtocol();
	logger.debug('Video protocol handler configured');

	// Set up renderer logging first, before any other IPC handlers
	setupLogging();
	
	// Setup IPC handlers (this will also start the continuous recording)
	logger.debug('Setting up IPC handlers and starting continuous recording...');
	setupIpcHandlers();
	logger.info('IPC handlers configured and continuous recording started');

	// Setup authentication handlers
	setupAuthIpcHandlers();
	
	// Create the main window
	logger.debug('Creating main application window...');
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
		}
	});

	// Add window event listeners for logging
	mainWindow.on('close', (event) => {
		logger.debug('Main window close event triggered');
		
		// Check if should minimize to tray
		const settings = getCurrentSettings();
		if (!forceQuit && settings.minimizeToTray) {
			event.preventDefault();
			mainWindow.hide();
			logger.info('Window hidden instead of closed (minimize to tray active)');
			return false;
		}
	});
	
	mainWindow.on('closed', () => {
		logger.info('Main window closed');
		mainWindow = null;
	});
	
	mainWindow.on('focus', () => {
		logger.debug('Main window focused');
	});
	
	mainWindow.on('blur', () => {
		logger.debug('Main window lost focus');
	});
	
	mainWindow.on('minimize', () => {
		logger.debug('Main window minimized');
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
	
	// Create tray icon if needed
	const settings = getCurrentSettings();
	if (settings.minimizeToTray) {
		createTray();
	}
	
	// Register IPC handler for toggling tray functionality
	ipcMain.handle('toggle-tray-enabled', (event, enabled) => {
		logger.debug(`Toggle tray enabled: ${enabled}`);
		
		if (enabled && !tray) {
			createTray();
		} else if (!enabled && tray) {
			tray.destroy();
			tray = null;
			logger.debug('Tray icon destroyed');
		}
		
		return { success: true };
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
	
	// Check if should quit or just hide
	const settings = getCurrentSettings();
	if (settings.minimizeToTray && !forceQuit) {
		logger.info('Not quitting app due to minimizeToTray setting');
		return;
	}
	
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
	}, 500); // 500ms delay should be enough
});

// Additional app events for logging
app.on('activate', () => {
	logger.info('App activated (macOS)');
	// Handle macOS dock click when windows are closed
	if (BrowserWindow.getAllWindows().length === 0) {
		logger.debug('Creating a new window on activation (macOS)');
		// Create a new window
	}
});

app.on('browser-window-created', (event, window) => {
	logger.debug('New browser window created', { windowId: window.id });
});

app.on('before-quit', () => {
	logger.info('Application quit requested...');
	forceQuit = true;
	
	logger.debug('Stopping continuous recording before quit...');
	stopContinuousRecording();
	logger.debug('Continuous recording stopped before quit');
	
	logger.debug('Cleaning up IPC handlers before quit...');
	cleanupIpcHandlers();
	logger.debug('IPC handlers cleaned up before quit');
	
	// Clean up tray if it exists
	if (tray) {
		tray.destroy();
		tray = null;
		logger.debug('Tray icon destroyed before quit');
	}
	
	safelyDeleteRecordings();
	
	logger.info('Application ready to quit');
});

// Handle unhandled errors and rejections
process.on('uncaughtException', (error) => {
	logger.error('Uncaught exception in main process:', error);
});

process.on('unhandledRejection', (reason, promise) => {
	logger.error('Unhandled promise rejection in main process:', { reason, promise });
});