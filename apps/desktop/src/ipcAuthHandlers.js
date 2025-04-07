import { ipcMain } from 'electron';
import axios from 'axios';
import { getModuleLogger } from './logger';

const logger = getModuleLogger('ipcAuthHandlers.js');

// Default API URL - should be defined in environment variables or settings
const DEFAULT_API_URL = 'http://localhost:5001/api';

// Helper to get API URL
const getApiUrl = () => {
	return process.env.API_URL || DEFAULT_API_URL;
};

// Set up authentication IPC handlers
export function setupAuthIpcHandlers() {
	logger.debug('Setting up authentication IPC handlers...');
	
	// Login handler
	ipcMain.handle('auth-login', async (event, credentials) => {
		logger.debug('auth-login handler called');
		
		try {
			// Input validation - basic security check
			if (!credentials || !credentials.email || !credentials.password) {
				logger.warn('Login attempt with missing credentials');
				return { 
					success: false, 
					error: 'Email and password are required' 
				};
			}
			
			// Enforce size limits on credentials
			if (credentials.email.length > 100 || credentials.password.length > 128) {
				logger.warn('Login attempt with oversized credentials');
				return { 
					success: false, 
					error: 'Invalid credentials format' 
				};
			}
			
			const API_URL = getApiUrl();
			logger.debug(`Making login request to: ${API_URL}/auth/login`);
			
			// Send the login request to the API
			const response = await axios.post(`${API_URL}/auth/login`, credentials, {
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json'
				},
				timeout: 10000 // 10 second timeout
			});
			
			// Validate the response
			if (response.data && response.data.token && response.data.username) {
				logger.info('User logged in successfully');
				return {
					success: true,
					token: response.data.token,
					username: response.data.username
				};
			} else {
				logger.warn('Login failed: Invalid response format', response.data);
				return { 
					success: false, 
					error: 'Invalid response from server' 
				};
			}
		} catch (error) {
			// Handle specific HTTP errors
			if (error.response) {
				// The request was made and the server responded with a status code that falls out of the range of 2xx
				logger.error('Login error response:', {
					status: error.response.status,
					data: error.response.data
				});
				
				if (error.response.status === 401) {
					return { 
						success: false, 
						error: 'Invalid email or password' 
					};
				} else if (error.response.status === 429) {
					return { 
						success: false, 
						error: 'Too many login attempts. Please try again later.' 
					};
				}
				
				return { 
					success: false, 
					error: error.response.data?.message || 'Login failed' 
				};
			} else if (error.request) {
				// The request was made but no response was received
				logger.error('Login error - no response:', error.request);
				return { 
					success: false, 
					error: 'Unable to connect to the server. Please check your network connection.' 
				};
			} else {
				// Something happened in setting up the request that triggered an Error
				logger.error('Login error:', error);
				return { 
					success: false, 
					error: 'An unexpected error occurred' 
				};
			}
		}
	});
	
	// Register handler
	ipcMain.handle('auth-register', async (event, userData) => {
		logger.debug('auth-register handler called');
		
		try {
			// Input validation
			if (!userData || !userData.username || !userData.email || !userData.password) {
				logger.warn('Registration attempt with missing data');
				return { 
					success: false, 
					error: 'Username, email, and password are required' 
				};
			}
			
			// Enforce size limits
			if (
				userData.username.length > 50 || 
				userData.email.length > 100 || 
				userData.password.length > 128
			) {
				logger.warn('Registration attempt with oversized data');
				return { 
					success: false, 
					error: 'Invalid data format' 
				};
			}
			
			const API_URL = getApiUrl();
			logger.debug(`Making registration request to: ${API_URL}/auth/register`);
			
			// Send the registration request to the API
			const response = await axios.post(`${API_URL}/auth/register`, userData, {
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json'
				},
				timeout: 10000 // 10 second timeout
			});
			
			logger.info('User registered successfully');
			return { success: true };
		} catch (error) {
			// Handle specific HTTP errors
			if (error.response) {
				logger.error('Registration error response:', {
					status: error.response.status,
					data: error.response.data
				});
				
				if (error.response.status === 400) {
					return { 
						success: false, 
						error: error.response.data?.message || 'User already exists or invalid data' 
					};
				}
				
				return { 
					success: false, 
					error: error.response.data?.message || 'Registration failed' 
				};
			} else if (error.request) {
				logger.error('Registration error - no response:', error.request);
				return { 
					success: false, 
					error: 'Unable to connect to the server. Please check your network connection.' 
				};
			} else {
				logger.error('Registration error:', error);
				return { 
					success: false, 
					error: 'An unexpected error occurred' 
				};
			}
		}
	});
	
	// Token validation handler
	ipcMain.handle('auth-validate-token', async (event, token) => {
		logger.debug('auth-validate-token handler called');
		
		try {
			// Input validation
			if (!token) {
				logger.warn('Token validation attempt with missing token');
				return { success: false };
			}
			
			const API_URL = getApiUrl();
			logger.debug(`Making token validation request to: ${API_URL}/auth/profile`);
			
			// Send the validation request to the API
			const response = await axios.get(`${API_URL}/auth/profile`, {
				headers: {
					'Authorization': `Bearer ${token}`,
					'Accept': 'application/json'
				},
				timeout: 8000 // 8 second timeout
			});
			
			if (response.data) {
				logger.debug('Token validated successfully');
				return { 
					success: true, 
					user: response.data 
				};
			} else {
				logger.warn('Token validation failed: Invalid response');
				return { success: false };
			}
		} catch (error) {
			if (error.response && error.response.status === 401) {
				logger.warn('Token validation failed: Unauthorized');
				return { success: false };
			}
			
			logger.error('Token validation error:', error);
			return { success: false };
		}
	});
	
	logger.info('Authentication IPC handlers setup complete');
}

export default setupAuthIpcHandlers;