// Storage keys
const STORAGE_KEYS = {
	AUTH: 'gcasp_auth',
	OFFLINE_MODE: 'gcasp_offline_mode',
	DEVICE_ID: 'gcasp_device_id'
};

// Convert string to ArrayBuffer for Web Crypto API
const str2ab = (str) => {
	const encoder = new TextEncoder();
	return encoder.encode(str);
};

// Convert ArrayBuffer to string
const ab2str = (buf) => {
	const decoder = new TextDecoder();
	return decoder.decode(buf);
};

// Convert hex string to ArrayBuffer
const hex2ab = (hex) => {
	const buffer = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		buffer[i / 2] = parseInt(hex.substring(i, i + 2), 16);
	}
	return buffer;
};

// Convert ArrayBuffer to hex string
const ab2hex = (buffer) => {
	return Array.from(new Uint8Array(buffer))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
};

// Generate a secure device-specific ID using Web Crypto
const generateDeviceId = async () => {
	const array = new Uint8Array(16); // 128 bits
	window.crypto.getRandomValues(array);
	return ab2hex(array);
};

// Get or create device ID for key derivation
const getDeviceId = async () => {
	let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
	
	if (!deviceId) {
		deviceId = await generateDeviceId();
		localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
	}
	
	return deviceId;
};

// Derive encryption key from device ID
const getEncryptionKey = async () => {
	const deviceId = await getDeviceId();
	const salt = 'GCASP_SECURE_SALT'; // Use unique salt later in production
	
	// Get key material from device ID
	const encoder = new TextEncoder();
	const keyMaterial = await window.crypto.subtle.importKey(
		'raw',
		encoder.encode(deviceId),
		{ name: 'PBKDF2' },
		false,
		['deriveBits', 'deriveKey']
	);
	
	// Derive the actual key using PBKDF2
	return window.crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt: encoder.encode(salt),
			iterations: 100000,
			hash: 'SHA-256'
		},
		keyMaterial,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
};

// Encrypt data
const encrypt = async (data) => {
	try {
		const key = await getEncryptionKey();
		const iv = window.crypto.getRandomValues(new Uint8Array(12));
		const encoder = new TextEncoder();
		
		const encryptedContent = await window.crypto.subtle.encrypt(
			{
				name: 'AES-GCM',
				iv
			},
			key,
			encoder.encode(JSON.stringify(data))
		);
		
		// Store both the IV and the encrypted data
		return JSON.stringify({
			iv: ab2hex(iv),
			data: ab2hex(new Uint8Array(encryptedContent))
		});
	} catch (error) {
		console.error('Encryption error:', error);
		return null;
	}
};

// Decrypt data
const decrypt = async (encryptedData) => {
	try {
		const { iv, data } = JSON.parse(encryptedData);
		const key = await getEncryptionKey();
		
		const decryptedContent = await window.crypto.subtle.decrypt(
			{
				name: 'AES-GCM',
				iv: hex2ab(iv)
			},
			key,
			hex2ab(data)
		);
		
		const decoder = new TextDecoder();
		return JSON.parse(decoder.decode(decryptedContent));
	} catch (error) {
		console.error('Decryption error:', error);
		return null;
	}
};

export const secureStorage = {
	// Save auth data securely
	saveAuth: async (user, token, rememberMe = false) => {
		try {
			// Don't store sensitive fields
			const sanitizedUser = {
				username: user.username,
				email: user.email
			};

			// Set token expiration (24 hours for session, 7 days for remember me)
			const expiresAt = new Date();
			if (rememberMe) {
				expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
			} else {
				expiresAt.setHours(expiresAt.getHours() + 4); // 4 hours
			}

			// Build auth data object
			const authData = {
				user: sanitizedUser,
				token,
				refreshToken: '', // Add refresh token support in the future
				expiresAt: expiresAt.toISOString(),
				rememberMe
			};

			// Encrypt the auth data
			const encryptedData = await encrypt(authData);
			if (!encryptedData) {
				throw new Error('Failed to encrypt auth data');
			}

			if (rememberMe) {
				// Store in localStorage for remembered sessions
				localStorage.setItem(STORAGE_KEYS.AUTH, encryptedData);
			} else {
				// Use sessionStorage for non-remembered sessions
				sessionStorage.setItem(STORAGE_KEYS.AUTH, encryptedData);
				// Clean up any previous remembered session
				localStorage.removeItem(STORAGE_KEYS.AUTH);
			}
			
			return true;
		} catch (error) {
			console.error('Error saving auth data:', error);
			return false;
		}
	},
	
	// Get auth data
	getAuth: async () => {
		try {
			// Try localStorage first (for remembered sessions)
			let encryptedData = localStorage.getItem(STORAGE_KEYS.AUTH);
			let storage = 'localStorage';
			
			// If not found, try sessionStorage
			if (!encryptedData) {
				encryptedData = sessionStorage.getItem(STORAGE_KEYS.AUTH);
				storage = 'sessionStorage';
			}
			
			// No data found
			if (!encryptedData) {
				return null;
			}
			
			// Decrypt the data
			const authData = await decrypt(encryptedData);
			if (!authData) {
				// Invalid data, clear it
				localStorage.removeItem(STORAGE_KEYS.AUTH);
				sessionStorage.removeItem(STORAGE_KEYS.AUTH);
				return null;
			}
			
			// Check if token is expired
			if (new Date() > new Date(authData.expiresAt)) {
				// Token expired, clear it
				await secureStorage.clearAuth();
				return null;
			}
			
			return authData;
		} catch (error) {
			console.error('Error getting auth data:', error);
			await secureStorage.clearAuth(); // Clear potentially corrupted data
			return null;
		}
	},
	
	// Get current user
	getUser: async () => {
		const authData = await secureStorage.getAuth();
		return authData ? authData.user : null;
	},
	
	// Get authentication token
	getToken: async () => {
		const authData = await secureStorage.getAuth();
		return authData ? authData.token : null;
	},
	
	// Check if token is expired
	isTokenExpired: async () => {
		const authData = await secureStorage.getAuth();
		if (!authData) {
			return true; // No auth data, consider expired
		}
		
		return new Date() > new Date(authData.expiresAt);
	},
	
	// Check if "remember me" is enabled
	isRememberMeEnabled: async () => {
		const authData = await secureStorage.getAuth();
		return authData ? authData.rememberMe : false;
	},
	
	// Clear auth data
	clearAuth: async () => {
		try {
			// Clear all auth data from both storages
			localStorage.removeItem(STORAGE_KEYS.AUTH);
			sessionStorage.removeItem(STORAGE_KEYS.AUTH);
			return true;
		} catch (error) {
			console.error('Error clearing auth data:', error);
			return false;
		}
	},
	
	// Offline mode functions (not encrypted since not sensitive)
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

export default secureStorage;