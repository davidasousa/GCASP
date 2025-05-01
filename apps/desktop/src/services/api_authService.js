import config from './api_config';

// Authentication service
const authService = {
	// Login a user
	async login(email, password) {
		try {
			if (!window.electron?.auth?.login) {
				throw new Error('Authentication not available');
			}
			
			window.electron.log.debug('Attempting login with email', { email });
			const response = await window.electron.auth.login({ email, password });
			
			if (!response.success) {
				throw new Error(response.error || 'Login failed');
			}
			
			window.electron.log.info('User logged in successfully');
			return response;
		} catch (error) {
			config.handleError(error, 'login');
		}
	},
	
	// Register a new user
	async register(username, email, password) {
		try {
			if (!window.electron?.auth?.register) {
				throw new Error('Authentication not available');
			}
			
			window.electron.log.debug('Attempting to register new user', { username, email });
			const response = await window.electron.auth.register({ 
				username, 
				email, 
				password 
			});
			
			if (!response.success) {
				throw new Error(response.error || 'Registration failed');
			}
			
			window.electron.log.info('User registered successfully');
			return response;
		} catch (error) {
			config.handleError(error, 'register');
		}
	},
	
	// Validate a token
	async validateToken(token) {
		try {
			if (!window.electron?.auth?.validateToken) {
				throw new Error('Authentication not available');
			}
			
			window.electron.log.debug('Validating authentication token');
			const result = await window.electron.auth.validateToken(token);
			
			if (result.success) {
				window.electron.log.debug('Token validated successfully');
			} else {
				window.electron.log.warn('Token validation failed');
			}
			
			return result;
		} catch (error) {
			config.handleError(error, 'validateToken');
		}
	}
};

export default authService;