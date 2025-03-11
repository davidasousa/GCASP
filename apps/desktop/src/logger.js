import winston from 'winston';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

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

	// Define log format
	const logFormat = winston.format.combine(
		winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
		winston.format.errors({ stack: true }),
		winston.format.splat(),
		winston.format.printf(({ level, message, timestamp, ...meta }) => {
			return `${timestamp} [${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
		})
	);

	// Create logger
	const logger = winston.createLogger({
		level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
		format: logFormat,
		defaultMeta: { service: 'desktop-app' },
		transports: [
			// Write logs to console
			new winston.transports.Console({
				format: winston.format.combine(
					winston.format.colorize(),
					logFormat
				)
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

	// Log startup information
	logger.info('Logger initialized for GCASP Desktop');
	logger.info(`App version: ${app.getVersion()}`);
	logger.info(`Electron version: ${process.versions.electron}`);
	logger.info(`Chrome version: ${process.versions.chrome}`);
	logger.info(`Node version: ${process.versions.node}`);
	logger.info(`Platform: ${process.platform}`);

	return logger;
}

// Create and export the logger
const logger = createLogger();

// Add renderer process logging via IPC
const setupRendererLogging = (ipcMain) => {
	ipcMain.handle('log', (event, { level, message, meta }) => {
		// Add source context for renderer logs
		const contextMeta = { ...meta, source: 'renderer' };
		logger.log(level, message, contextMeta);
	});
};

// Helper methods for common use cases
const logError = (message, meta = {}) => logger.error(message, meta);
const logWarn = (message, meta = {}) => logger.warn(message, meta);
const logInfo = (message, meta = {}) => logger.info(message, meta);
const logDebug = (message, meta = {}) => logger.debug(message, meta);

export default logger;
export { setupRendererLogging, logError, logWarn, logInfo, logDebug };