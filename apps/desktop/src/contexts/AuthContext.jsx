import React, { createContext, useState, useEffect, useCallback } from 'react';
import { secureStorage } from '../utils/secureStorage';
import { validatePassword, validateEmail, validateUsername } from '../utils/validation';

export const AuthContext = createContext();

// Authentication throttling to prevent brute force attacks
const authThrottling = {
	attempts: 0,
	lastAttempt: 0,
	lockoutUntil: 0,
	
	// Check if auth attempts are being throttled
	isThrottled: () => {
		const now = Date.now();
		
		// Reset after 1 hour of no attempts
		if (now - authThrottling.lastAttempt > 3600000) {
			authThrottling.attempts = 0;
			authThrottling.lockoutUntil = 0;
		}
		
		// Check if currently locked out
		if (authThrottling.lockoutUntil > now) {
			const waitTime = Math.ceil((authThrottling.lockoutUntil - now) / 1000);
			return {
				throttled: true,
				message: `Too many login attempts. Please try again in ${waitTime} seconds.`
			};
		}
		
		return { throttled: false };
	},
	
	// Record an auth attempt and apply throttling if needed
	recordAttempt: (success) => {
		const now = Date.now();
		authThrottling.lastAttempt = now;
		
		// Reset counter on successful login
		if (success) {
			authThrottling.attempts = 0;
			authThrottling.lockoutUntil = 0;
			return;
		}
		
		// Increment failed attempts
		authThrottling.attempts++;
		
		// Apply exponential backoff for repeated failures
		if (authThrottling.attempts >= 5) {
			// Calculate lockout time: 30 seconds * 2^(attempts-5)
			// This gives 30s, 1m, 2m, 4m, 8m, etc.
			const lockoutSeconds = 30 * Math.pow(2, authThrottling.attempts - 5);
			// Cap at 1 hour
			const maxLockout = 3600;
			authThrottling.lockoutUntil = now + Math.min(lockoutSeconds, maxLockout) * 1000;
		}
	}
};

export const AuthProvider = ({ children }) => {
	const [currentUser, setCurrentUser] = useState(null);
	const [loading, setLoading] = useState(true);
	const [isOfflineMode, setIsOfflineMode] = useState(false);
	const [error, setError] = useState(null);
	const [showLoginModal, setShowLoginModal] = useState(false);

	// Load user from storage on startup
	useEffect(() => {
		const loadUserState = async () => {
			try {
				setLoading(true);
				
				window.electron.log.info('Starting authentication state check...');

				// Check storage state for debugging
				const STORAGE_KEYS = {
					AUTH: 'gcasp_auth',
					OFFLINE_MODE: 'gcasp_offline_mode'
				};
				
				const hasLocalAuth = !!localStorage.getItem(STORAGE_KEYS.AUTH);
				const hasSessionAuth = !!sessionStorage.getItem(STORAGE_KEYS.AUTH);
				const hasOfflineMode = !!localStorage.getItem(STORAGE_KEYS.OFFLINE_MODE);

				window.electron.log.info('Storage state:', { 
					hasLocalAuth,
					hasSessionAuth, 
					hasOfflineMode 
				});
				
				// First try to load auth data regardless of offline mode
				const authData = await secureStorage.getAuth();
				
				if (authData && authData.token) {
					// We have valid auth data, so try to validate the token
					try {
						const validationResult = await window.electron.auth.validateToken(authData.token);
						
						if (validationResult.success) {
							// Token is valid, set user state and ensure offline mode is OFF
							setCurrentUser({
								...authData.user,
								...validationResult.user // Merge any updated user info
							});
							// Make sure offline mode is disabled when we have valid auth
							setIsOfflineMode(false);
							secureStorage.setOfflineMode(false);
							window.electron.log.info('User authenticated from stored credentials');
							setLoading(false);
							return; // Exit early since we're authenticated
						} else {
							// Token is invalid, clear storage
							await secureStorage.clearAuth();
							window.electron.log.warn('Stored token is invalid, clearing auth state');
						}
					} catch (validationError) {
						// Error validating token - network might be down
						window.electron.log.error('Error validating token', { 
							error: validationError.toString() 
						});

					}
				}
				
				// If we get here, either there's no token or the token validation failed
				// Now check if offline mode is enabled
				const offlineMode = secureStorage.isOfflineMode();
				if (offlineMode) {
					setIsOfflineMode(true);
					setCurrentUser(null); // Ensure user is null in offline mode
					window.electron.log.info('Offline mode enabled');
				} else {
					// Not authenticated and not in offline mode
					setIsOfflineMode(false);
					setCurrentUser(null);
					window.electron.log.info('Not authenticated and not in offline mode');
				}
			} catch (error) {
				window.electron.log.error('Error loading auth state', { 
					error: error.toString() 
				});
				setError('Authentication system error. Please restart the application.');
			} finally {
				setLoading(false);
			}
		};
		
		loadUserState();
	}, []);
	
	// Login function with rate limiting and enhanced validation
	const login = useCallback(async (email, password, rememberMe) => {
		try {
			setLoading(true);
			setError(null);
			
			// Check for throttling
			const throttleCheck = authThrottling.isThrottled();
			if (throttleCheck.throttled) {
				throw new Error(throttleCheck.message);
			}
			
			// Validate inputs
			const emailValidation = validateEmail(email);
			if (!emailValidation.valid) {
				throw new Error(emailValidation.message);
			}
			
			// We don't validate password format here since the server should handle
			// different password policies, but we check it's not empty
			if (!password) {
				throw new Error('Password is required');
			}
			
			// Call the IPC handler for login
			const response = await window.electron.auth.login({ email, password });
			
			// Record login attempt result for throttling
			authThrottling.recordAttempt(response.success);
			
			if (!response.success) {
				throw new Error(response.error || 'Login failed');
			}
			
			const { token, username } = response;
			
			if (!token || !username) {
				throw new Error('Invalid response from server');
			}
			
			// Create user object
			const user = {
				username,
				email
			};
			
			// Save to secure storage based on remember me setting
			await secureStorage.saveAuth(user, token, rememberMe);
			
			// Update state
			setCurrentUser(user);
			
			// Explicitly disable offline mode when logging in
			setIsOfflineMode(false);
			secureStorage.setOfflineMode(false);
			
			window.electron.log.info('User logged in successfully');
			return true;
		} catch (error) {
			window.electron.log.error('Login error', { error: error.toString() });
			setError(error.message || 'Login failed');
			throw error;
		} finally {
			setLoading(false);
		}
	}, []);
	
	// Register function with enhanced validation
	const register = useCallback(async (username, email, password, confirmPassword) => {
		try {
			setLoading(true);
			setError(null);
			
			// Validate username
			const usernameValidation = validateUsername(username);
			if (!usernameValidation.valid) {
				throw new Error(usernameValidation.message);
			}
			
			// Validate email
			const emailValidation = validateEmail(email);
			if (!emailValidation.valid) {
				throw new Error(emailValidation.message);
			}
			
			// Validate password
			const passwordValidation = validatePassword(password);
			if (!passwordValidation.valid) {
				throw new Error(passwordValidation.message);
			}
			
			// Check password confirmation
			if (password !== confirmPassword) {
				throw new Error('Passwords do not match');
			}
			
			// Call the IPC handler for registration
			const response = await window.electron.auth.register({ 
				username, 
				email, 
				password 
			});
			
			if (!response.success) {
				throw new Error(response.error || 'Registration failed');
			}
			
			window.electron.log.info('User registered successfully');
			return true;
		} catch (error) {
			window.electron.log.error('Registration error', { error: error.toString() });
			setError(error.message || 'Registration failed');
			throw error;
		} finally {
			setLoading(false);
		}
	}, []);
	
	// Logout function
	const logout = useCallback(async () => {
		// Clear auth data from storage
		await secureStorage.clearAuth();
		
		// Update state
		setCurrentUser(null);
		setIsOfflineMode(false);
		
		window.electron.log.info('User logged out');
	}, []);
	
	// Toggle offline mode
	const toggleOfflineMode = useCallback((enabled) => {
		setIsOfflineMode(enabled);
		
		// Only save to storage if we're specifically turning it on
		if (enabled) {
			secureStorage.setOfflineMode(true);
			// When enabling offline mode, clear current user
			setCurrentUser(null);
			window.electron.log.info('Offline mode enabled');
		} else {
			secureStorage.setOfflineMode(false);
			window.electron.log.info('Offline mode disabled');
		}
	}, []);

	// Function to show the login modal
	const openLoginModal = useCallback(() => {
		setShowLoginModal(true);
	}, []);

	// Function to hide the login modal
	const closeLoginModal = useCallback(() => {
		setShowLoginModal(false);
	}, []);
	
	// Function to clear login / register errors
	const clearError = useCallback(() => {
		setError(null);
	}, []);

	// Provide auth context values
	const value = {
		currentUser,
		isAuthenticated: !!currentUser,
		isOfflineMode,
		loading,
		error,
		login,
		register,
		logout,
		toggleOfflineMode,
		openLoginModal,
		closeLoginModal,
		showLoginModal,
		clearError
	};
	
	return (
		<AuthContext.Provider value={value}>
			{children}
		</AuthContext.Provider>
	);
};

// Hook for easy access to auth context
export const useAuth = () => {
	const context = React.useContext(AuthContext);
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};