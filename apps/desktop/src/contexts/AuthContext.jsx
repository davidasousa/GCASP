import React, { createContext, useState, useEffect, useCallback } from 'react';
import { storage } from '../utils/storage';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
	const [currentUser, setCurrentUser] = useState(null);
	const [loading, setLoading] = useState(true);
	const [isOfflineMode, setIsOfflineMode] = useState(false);
	const [error, setError] = useState(null);
	// Add state for login modal
	const [showLoginModal, setShowLoginModal] = useState(false);

	// Load user from storage on startup
	useEffect(() => {
		const loadUserState = async () => {
			try {
				setLoading(true);
				
				// Check if offline mode is enabled
				const offlineMode = storage.isOfflineMode();
				if (offlineMode) {
					setIsOfflineMode(true);
					setLoading(false);
					return;
				}
				
				// Try to load user and token
				const savedUser = storage.getUser();
				const token = storage.getToken();
				
				if (savedUser && token) {
					// Validate token with backend
					try {
						const validationResult = await window.electron.auth.validateToken(token);
						
						if (validationResult.success) {
							// Token is valid, set user state
							setCurrentUser({
								...savedUser,
								...validationResult.user, // Merge any updated user info
							});
							window.electron.log.info('User authenticated from stored credentials');
						} else {
							// Token is invalid, clear storage
							storage.clearAuth();
							window.electron.log.warn('Stored token is invalid, clearing auth state');
						}
					} catch (validationError) {
						// Error validating token, but don't clear storage yet
						// This could be a network issue, and we can try again later
						window.electron.log.error('Error validating token', validationError);
					}
				}
			} catch (error) {
				window.electron.log.error('Error loading auth state', { error: error.toString() });
				setError('Authentication system error. Please restart the application.');
			} finally {
				setLoading(false);
			}
		};
		
		loadUserState();
	}, []);
	
	// Login function
	const login = useCallback(async (email, password, rememberMe) => {
		try {
			setLoading(true);
			setError(null);
			
			// Call the IPC handler for login
			const response = await window.electron.auth.login({ email, password });
			
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
			
			// Save to storage based on remember me setting
			storage.saveUser(user, token, rememberMe);
			
			// Update state
			setCurrentUser(user);
			setIsOfflineMode(false);
			
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
	
	// Register function
	const register = useCallback(async (username, email, password) => {
		try {
			setLoading(true);
			setError(null);
			
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
	const logout = useCallback(() => {
		// Clear auth data from storage
		storage.clearAuth();
		
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
			storage.setOfflineMode(true);
			// When enabling offline mode, clear current user
			setCurrentUser(null);
			window.electron.log.info('Offline mode enabled');
		} else {
			storage.setOfflineMode(false);
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
		showLoginModal
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