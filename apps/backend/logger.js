// Logger for the GCASP Backend server
import winston from 'winston';
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

// Initialize the logger for Backend server
function createLogger() {
	// Ensure log directory exists
	const projectLogDir = path.join(process.cwd(), 'logs');

	if (!fs.existsSync(projectLogDir)) {
		fs.mkdirSync(projectLogDir, { recursive: true });
		console.log(`Created project log directory at: ${projectLogDir}`);
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
			// Write logs to project directory
			new winston.transports.File({ 
				filename: path.join(projectLogDir, 'server-error.log'), 
				level: 'error',
				maxsize: 5 * 1024 * 1024, // 5MB
				maxFiles: 5
			}),
			new winston.transports.File({ 
				filename: path.join(projectLogDir, 'server-combined.log'),
				maxsize: 10 * 1024 * 1024, // 10MB
				maxFiles: 5
			})
		],
		// Handle uncaught exceptions
		exceptionHandlers: [
			new winston.transports.File({ 
				filename: path.join(projectLogDir, 'server-exceptions.log'),
				maxsize: 5 * 1024 * 1024, // 5MB
				maxFiles: 5
			})
		],
	});

	// Log startup information
    const selfLogger = logger.child({ label: 'logger.js' });
    
	selfLogger.info('Logger initialized for GCASP Backend');
	selfLogger.info(`Node version: ${process.version}`);
	selfLogger.info(`Platform: ${process.platform}`);
	selfLogger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

	return logger;
}

// Create and export the logger
const logger = createLogger();

// Helper to get a child logger with a module label.
export function getModuleLogger(moduleLabel) {
	return logger.child({ label: moduleLabel });
}

export default logger;