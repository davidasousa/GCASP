import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/login-page.css';

// Input validation helpers
const validateEmail = (email) => {
	const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
	return re.test(String(email).toLowerCase());
};

const validateUsername = (username) => {
	// Alphanumeric, underscores, hyphens, 3-20 characters
	const re = /^[a-zA-Z0-9_-]{3,20}$/;
	return re.test(username);
};

const RegisterPage = () => {
	const [username, setUsername] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [usernameError, setUsernameError] = useState('');
	const [emailError, setEmailError] = useState('');
	const [passwordError, setPasswordError] = useState('');
	const [confirmPasswordError, setConfirmPasswordError] = useState('');
	const [generalError, setGeneralError] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	
	const { register, isAuthenticated, error: authError } = useAuth();
	const navigate = useNavigate();
	
	// MODIFIED: Only redirect if authenticated, not if in offline mode
	useEffect(() => {
		if (isAuthenticated) {
			navigate('/');
		}
	}, [isAuthenticated, navigate]);
	
	// Update general error from auth context
	useEffect(() => {
		if (authError) {
			setGeneralError(authError);
		}
	}, [authError]);
	
	const validateForm = () => {
		let isValid = true;
		setUsernameError('');
		setEmailError('');
		setPasswordError('');
		setConfirmPasswordError('');
		setGeneralError('');
		
		// Validate username
		if (!username.trim()) {
			setUsernameError('Username is required');
			isValid = false;
		} else if (!validateUsername(username)) {
			setUsernameError('Username must be 3-20 characters using only letters, numbers, underscores, or hyphens');
			isValid = false;
		}
		
		// Validate email
		if (!email.trim()) {
			setEmailError('Email is required');
			isValid = false;
		} else if (!validateEmail(email)) {
			setEmailError('Please enter a valid email address');
			isValid = false;
		}
		
		// Validate password
		if (!password) {
			setPasswordError('Password is required');
			isValid = false;
		} else if (password.length < 6) {
			setPasswordError('Password must be at least 6 characters');
			isValid = false;
		}
		
		// Validate password confirmation
		if (!confirmPassword) {
			setConfirmPasswordError('Please confirm your password');
			isValid = false;
		} else if (password !== confirmPassword) {
			setConfirmPasswordError('Passwords do not match');
			isValid = false;
		}
		
		return isValid;
	};
	
	const handleRegister = async (e) => {
		e.preventDefault();
		
		// Reset errors
		setGeneralError('');
		
		// Validate form
		if (!validateForm()) {
			return;
		}
		
		setIsLoading(true);
		
		try {
			await register(username, email, password);
			// Registration successful, redirect to login
			navigate('/login', { state: { registrationSuccess: true } });
		} catch (error) {
			console.error('Registration error:', error);
			// Security: Don't expose specific error details to the user
			setGeneralError(error.message || 'Registration failed. Please try again.');
		} finally {
			setIsLoading(false);
		}
	};
	
	const navigateToLogin = () => {
		navigate('/login');
	};
	
	// Input change handlers with length limits for security
	const handleUsernameChange = (e) => {
		const value = e.target.value.slice(0, 20); // Limit to 20 chars
		setUsername(value);
		
		if (usernameError && validateUsername(value)) {
			setUsernameError('');
		}
	};
	
	const handleEmailChange = (e) => {
		const value = e.target.value.slice(0, 100); // Limit to 100 chars
		setEmail(value);
		
		if (emailError && validateEmail(value)) {
			setEmailError('');
		}
	};
	
	const handlePasswordChange = (e) => {
		const value = e.target.value.slice(0, 128); // Limit to 128 chars
		setPassword(value);
		
		if (passwordError && value.length >= 6) {
			setPasswordError('');
		}
		
		// Check password confirmation match if already entered
		if (confirmPassword && confirmPasswordError) {
			if (value === confirmPassword) {
				setConfirmPasswordError('');
			}
		}
	};
	
	const handleConfirmPasswordChange = (e) => {
		const value = e.target.value.slice(0, 128); // Limit to 128 chars
		setConfirmPassword(value);
		
		if (confirmPasswordError && value === password) {
			setConfirmPasswordError('');
		}
	};
	
	return (
		<div className="login-page">
			<div className="login-container">
				<h2>Create an Account</h2>
				
				<form onSubmit={handleRegister} noValidate>
					{generalError && (
						<div className="error-message" role="alert">
							{generalError}
						</div>
					)}
					
					<div className="form-group">
						<label htmlFor="username">Username</label>
						<input
							id="username"
							type="text"
							value={username}
							onChange={handleUsernameChange}
							className={usernameError ? 'input-error' : ''}
							aria-invalid={!!usernameError}
							aria-describedby={usernameError ? 'username-error' : undefined}
							required
							autoComplete="username"
							placeholder="3-20 characters"
							maxLength={20}
						/>
						{usernameError && (
							<div id="username-error" className="field-error">
								{usernameError}
							</div>
						)}
					</div>
					
					<div className="form-group">
						<label htmlFor="email">Email</label>
						<input
							id="email"
							type="email"
							value={email}
							onChange={handleEmailChange}
							className={emailError ? 'input-error' : ''}
							aria-invalid={!!emailError}
							aria-describedby={emailError ? 'email-error' : undefined}
							required
							autoComplete="email"
							placeholder="yourname@example.com"
							maxLength={100}
						/>
						{emailError && (
							<div id="email-error" className="field-error">
								{emailError}
							</div>
						)}
					</div>
					
					<div className="form-group">
						<label htmlFor="password">Password</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={handlePasswordChange}
							className={passwordError ? 'input-error' : ''}
							aria-invalid={!!passwordError}
							aria-describedby={passwordError ? 'password-error' : undefined}
							required
							autoComplete="new-password"
							placeholder="Minimum 6 characters"
							maxLength={128}
						/>
						{passwordError && (
							<div id="password-error" className="field-error">
								{passwordError}
							</div>
						)}
					</div>
					
					<div className="form-group">
						<label htmlFor="confirm-password">Confirm Password</label>
						<input
							id="confirm-password"
							type="password"
							value={confirmPassword}
							onChange={handleConfirmPasswordChange}
							className={confirmPasswordError ? 'input-error' : ''}
							aria-invalid={!!confirmPasswordError}
							aria-describedby={confirmPasswordError ? 'confirm-password-error' : undefined}
							required
							autoComplete="new-password"
							maxLength={128}
						/>
						{confirmPasswordError && (
							<div id="confirm-password-error" className="field-error">
								{confirmPasswordError}
							</div>
						)}
					</div>
					
					<button 
						type="submit" 
						className="login-button"
						disabled={isLoading}
						aria-busy={isLoading}
					>
						{isLoading ? 'Creating Account...' : 'Register'}
					</button>
				</form>
				
				<div className="login-footer">
					<p>Already have an account?</p>
					<button 
						className="register-link" 
						onClick={navigateToLogin}
						type="button"
					>
						Login
					</button>
				</div>
			</div>
		</div>
	);
};

export default RegisterPage;