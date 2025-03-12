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

	// Define console format with colors and timestamps
    const consoleFormat = winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.colorize({ level: true }),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
            const { service, ...restMeta } = meta;
            const metaStr = Object.keys(restMeta).length
                ? ` ${JSON.stringify(restMeta)}`
                : '';
    
            // Apply ANSI escape codes to make timestamp green
            const greenTimestamp = `\x1b[32m${timestamp}\x1b[0m`;
    
            return `${greenTimestamp} [${level}]: ${message}${metaStr}`;
        })
    );

	// Define file format without colors but with timestamps
	const fileFormat = winston.format.combine(
		winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
		winston.format.errors({ stack: true }),
		winston.format.splat(),
		winston.format.printf(({ level, message, timestamp, ...meta }) => {
			const { service, ...restMeta } = meta;
			const metaStr = Object.keys(restMeta).length ? 
				` ${JSON.stringify(restMeta, null, 2)}` : '';
			return `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}`;
		})
	);

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

export default logger;
export { setupRendererLogging };