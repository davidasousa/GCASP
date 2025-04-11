// Password strength validation - returns {valid: boolean, message: string}
export const validatePassword = (password) => {
	// Check length (minimum 8 characters)
	if (!password || password.length < 8) {
		return {
			valid: false,
			message: 'Password must be at least 8 characters long'
		};
	}
	
	// Check complexity (at least 3 of 4 categories)
	let score = 0;
	
	// Category 1: Lowercase letters
	if (/[a-z]/.test(password)) score++;
	
	// Category 2: Uppercase letters
	if (/[A-Z]/.test(password)) score++;
	
	// Category 3: Numbers
	if (/[0-9]/.test(password)) score++;
	
	// Category 4: Special characters
	if (/[^A-Za-z0-9]/.test(password)) score++;
	
	if (score < 3) {
		return {
			valid: false,
			message: 'Password must include at least 3 of the following: lowercase letters, uppercase letters, numbers, and special characters'
		};
	}
	
	// Check for common passwords
	const commonPasswords = [
		'password', 'password123', '12345678', 'qwerty123', 
		'letmein', 'welcome', 'admin123', '123456789'
	];
	
	if (commonPasswords.includes(password.toLowerCase())) {
		return {
			valid: false,
			message: 'This password is too common. Please choose a more secure password.'
		};
	}
	
	return { valid: true, message: '' };
};

// Email validation
export const validateEmail = (email) => {
	// Basic email regex
	const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
	
	if (!email || !emailRegex.test(email)) {
		return {
			valid: false,
			message: 'Please enter a valid email address'
		};
	}
	
	// Check length to prevent buffer overflow attacks
	if (email.length > 100) {
		return {
			valid: false,
			message: 'Email is too long'
		};
	}
	
	return { valid: true, message: '' };
};

// Username validation
export const validateUsername = (username) => {
	// Alphanumeric, underscores, hyphens, 3-20 characters
	const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
	
	if (!username || !usernameRegex.test(username)) {
		return {
			valid: false,
			message: 'Username must be 3-20 characters using only letters, numbers, underscores, or hyphens'
		};
	}
	
	return { valid: true, message: '' };
};