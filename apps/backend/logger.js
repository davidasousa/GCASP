// Logger for the GCASP Backend server
import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Initialize the logger for Backend server
function createLogger() {
	// Ensure log directory exists
	const projectLogDir = path.join(process.cwd(), 'logs');

	if (!fs.existsSync(projectLogDir)) {
		fs.mkdirSync(projectLogDir, { recursive: true });
		console.log(`Created project log directory at: ${projectLogDir}`);
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
	logger.info('Logger initialized for GCASP Backend');
	logger.info(`Node version: ${process.version}`);
	logger.info(`Platform: ${process.platform}`);
	logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

	return logger;
}

// Create and export the logger
const logger = createLogger();

export default logger;