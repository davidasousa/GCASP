const STORAGE_KEYS = {
	USER: 'gcasp_user',
	TOKEN: 'gcasp_token',
	REMEMBER_ME: 'gcasp_remember_me',
	OFFLINE_MODE: 'gcasp_offline_mode',
	TOKEN_EXPIRES: 'gcasp_token_expires'
};

// Central security utility for handling sensitive data
export const storage = {
	// Save user data securely
	saveUser: (user, token, rememberMe = false) => {
		try {
			// Don't store sensitive fields
			const sanitizedUser = {
				username: user.username,
				email: user.email,
				// Exclude password or other sensitive details
			};

			// Set token expiration (24 hours for session, 30 days for remember me)
			const expiresAt = new Date();
			if (rememberMe) {
				// 30 days if remember me is checked
				expiresAt.setDate(expiresAt.getDate() + 30);
			} else {
				// 24 hours for session
				expiresAt.setHours(expiresAt.getHours() + 24);
			}

			if (rememberMe) {
				// Store in localStorage for remembered sessions
				localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(sanitizedUser));
				localStorage.setItem(STORAGE_KEYS.TOKEN, token);
				localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, JSON.stringify(true));
				localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES, expiresAt.toISOString());
			} else {
				// Use sessionStorage for non-remembered sessions (cleared when window closes)
				sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(sanitizedUser));
				sessionStorage.setItem(STORAGE_KEYS.TOKEN, token);
				sessionStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES, expiresAt.toISOString());
				// Clean up any previous remembered session
				localStorage.removeItem(STORAGE_KEYS.USER);
				localStorage.removeItem(STORAGE_KEYS.TOKEN);
				localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
				localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRES);
			}
			return true;
		} catch (error) {
			console.error('Error saving user data:', error);
			return false;
		}
	},
	
	// Get user data
	getUser: () => {
		try {
			// Check if token is expired before returning user
			if (storage.isTokenExpired()) {
				storage.clearAuth();
				return null;
			}
			
			// Try localStorage first (for remembered sessions)
			let user = localStorage.getItem(STORAGE_KEYS.USER);
			
			// If not found, try sessionStorage
			if (!user) {
				user = sessionStorage.getItem(STORAGE_KEYS.USER);
			}
			
			return user ? JSON.parse(user) : null;
		} catch (error) {
			console.error('Error getting user data:', error);
			return null;
		}
	},
	
	// Get authentication token
	getToken: () => {
		try {
			// Check if token is expired
			if (storage.isTokenExpired()) {
				storage.clearAuth();
				return null;
			}
			
			// Try localStorage first
			let token = localStorage.getItem(STORAGE_KEYS.TOKEN);
			
			// If not found, try sessionStorage
			if (!token) {
				token = sessionStorage.getItem(STORAGE_KEYS.TOKEN);
			}
			
			return token;
		} catch (error) {
			console.error('Error getting token:', error);
			return null;
		}
	},
	
	// Check if token is expired
	isTokenExpired: () => {
		try {
			// Try localStorage first
			let expires = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES);
			
			// If not found, try sessionStorage
			if (!expires) {
				expires = sessionStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES);
			}
			
			if (!expires) {
				return true; // No expiration found, consider expired
			}
			
			return new Date() > new Date(expires);
		} catch (error) {
			console.error('Error checking token expiration:', error);
			return true; // If error, consider expired
		}
	},
	
	// Check if "remember me" is enabled
	isRememberMeEnabled: () => {
		try {
			const remember = localStorage.getItem(STORAGE_KEYS.REMEMBER_ME);
			return remember ? JSON.parse(remember) : false;
		} catch (error) {
			console.error('Error checking remember me setting:', error);
			return false;
		}
	},
	
	// Clear auth data
	clearAuth: () => {
		try {
			// Clear all auth data from both storages
			localStorage.removeItem(STORAGE_KEYS.USER);
			localStorage.removeItem(STORAGE_KEYS.TOKEN);
			localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
			localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRES);
			sessionStorage.removeItem(STORAGE_KEYS.USER);
			sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
			sessionStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRES);
			return true;
		} catch (error) {
			console.error('Error clearing auth data:', error);
			return false;
		}
	},
	
	// Offline mode functions
	setOfflineMode: (enabled) => {
		try {
			localStorage.setItem(STORAGE_KEYS.OFFLINE_MODE, JSON.stringify(enabled));
			return true;
		} catch (error) {
			console.error('Error setting offline mode:', error);
			return false;
		}
	},
	
	isOfflineMode: () => {
		try {
			const offlineMode = localStorage.getItem(STORAGE_KEYS.OFFLINE_MODE);
			return offlineMode ? JSON.parse(offlineMode) : false;
		} catch (error) {
			console.error('Error checking offline mode:', error);
			return false;
		}
	}
};

export default storage;