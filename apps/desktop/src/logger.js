import winston from 'winston';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

// Helper custom printf format that prints timestamp, module label, level, and message.
const customPrintf = winston.format.printf(({ level, message, timestamp, label, ...meta }) => {
	const metaKeys = Object.keys(meta);
	const metaStr = metaKeys.length > 0 ? ` ${JSON.stringify(meta)}` : '';
	// If label is missing, default to "unknown"
	const labelStr = label ? `[${label}]` : '[unknown]';
	return `${timestamp} ${labelStr} [${level}]: ${message}${metaStr}`;
});

// Define console format with colors, timestamps, and module label
const consoleFormat = winston.format.combine(
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
	winston.format.colorize({ all: true }),
	customPrintf
);

// Define file format without colors but with timestamps and module label
const fileFormat = winston.format.combine(
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
	winston.format.errors({ stack: true }),
	winston.format.splat(),
	customPrintf
);

// Initialize the logger for Electron main process
function createLogger() {
	// Ensure log directories exist
	const projectLogDir = path.join(process.cwd(), 'logs');
	const appDataLogDir = path.join(app.getPath('appData'), 'GCASP', 'logs');

	// Create log directories if they don't exist
	if (!fs.existsSync(projectLogDir)) {
		fs.mkdirSync(projectLogDir, { recursive: true });
		console.log(`Created project log directory at: ${projectLogDir}`);
	}
	if (!fs.existsSync(appDataLogDir)) {
		fs.mkdirSync(appDataLogDir, { recursive: true });
		console.log(`Created user log directory at: ${appDataLogDir}`);
	}

	// Create logger
	const logger = winston.createLogger({
		level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
		format: fileFormat,
		transports: [
			// Write logs to console with colors
			new winston.transports.Console({
				format: consoleFormat
			}),
			// Write logs to project directory (for developers)
			new winston.transports.File({ 
				filename: path.join(projectLogDir, 'desktop-error.log'), 
				level: 'error',
				maxsize: 5 * 1024 * 1024, // 5MB
				maxFiles: 5
			}),
			new winston.transports.File({ 
				filename: path.join(projectLogDir, 'desktop-combined.log'),
				maxsize: 10 * 1024 * 1024, // 10MB
				maxFiles: 5
			}),
			// Write logs to appData directory (for users)
			new winston.transports.File({ 
				filename: path.join(appDataLogDir, 'desktop-error.log'), 
				level: 'error',
				maxsize: 5 * 1024 * 1024, // 5MB
				maxFiles: 2
			}),
			new winston.transports.File({ 
				filename: path.join(appDataLogDir, 'desktop-combined.log'),
				maxsize: 10 * 1024 * 1024, // 10MB
				maxFiles: 2
			})
		],
		// Handle uncaught exceptions
		exceptionHandlers: [
			new winston.transports.File({ 
				filename: path.join(projectLogDir, 'desktop-exceptions.log'),
				maxsize: 5 * 1024 * 1024, // 5MB
				maxFiles: 5
			}),
			new winston.transports.File({ 
				filename: path.join(appDataLogDir, 'desktop-exceptions.log'),
				maxsize: 5 * 1024 * 1024, // 5MB
				maxFiles: 2
			})
		],
	});

    const selfLogger = logger.child({ label: 'logger.js' });

	// Log startup information
    selfLogger.info('Logger initialized for GCASP Desktop');
    selfLogger.info(`App version: ${app.getVersion()}`);
    selfLogger.info(`Electron version: ${process.versions.electron}`);
    selfLogger.info(`Chrome version: ${process.versions.chrome}`);
    selfLogger.info(`Node version: ${process.versions.node}`);
    selfLogger.info(`Platform: ${process.platform}`);

	return logger;
}

// Create and export the logger
const logger = createLogger();

// Helper to get a child logger with a module label
export function getModuleLogger(moduleLabel) {
	return logger.child({ label: moduleLabel });
}

// Flag to check if renderer logging has been set up
let rendererLoggingSetup = false;

// Set up renderer process logging via IPC
const setupRendererLogging = (ipcMain) => {
	// Prevent duplicate registration
	if (rendererLoggingSetup) {
		logger.debug('Renderer logging already set up, skipping');
		return;
	}

	try {
		// Add IPC handler for renderer process logging
		ipcMain.handle('log', (event, { level, message, meta = {} }) => {
			try {
				// Add source context for renderer logs
				const contextMeta = { ...meta, source: 'renderer' };
				logger.log(level, message, contextMeta);
				return { success: true };
			} catch (error) {
				console.error('Error in log handler:', error);
				return { success: false, error: error.message };
			}
		});
		
		rendererLoggingSetup = true;
		logger.debug('Renderer process logging handler registered successfully');
	} catch (error) {
		console.error('Failed to set up renderer logging:', error);
		logger.error('Failed to register log handler for renderer process:', error);
	}
};

// Check if renderer logging has been set up
const isRendererLoggingSetup = () => {
	return rendererLoggingSetup;
};

export default logger;
export { setupRendererLogging, isRendererLoggingSetup };