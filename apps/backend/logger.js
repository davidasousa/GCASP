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
		defaultMeta: { service: 'backend-server' },
		transports: [
			// Write logs to console
			new winston.transports.Console({
				format: winston.format.combine(
					winston.format.colorize(),
					logFormat
				)
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