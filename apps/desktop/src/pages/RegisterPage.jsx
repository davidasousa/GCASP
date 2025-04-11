import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { validateEmail, validateUsername, validatePassword } from '../utils/validation';
import '../styles/login-page.css';

const RegisterPage = () => {
	const [username, setUsername] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [usernameError, setUsernameError] = useState('');
	const [emailError, setEmailError] = useState('');
	const [passwordError, setPasswordError] = useState('');
	const [confirmPasswordError, setConfirmPasswordError] = useState('');
	const [generalError, setGeneralError] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [passwordStrength, setPasswordStrength] = useState(0); // 0-3
	
	const { register, isAuthenticated, error: authError } = useAuth();
	const navigate = useNavigate();
	
	// Only redirect if authenticated, not if in offline mode
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
	
	// Calculate password strength for visual indicator
	useEffect(() => {
		if (!password) {
			setPasswordStrength(0);
			return;
		}
		
		let score = 0;
		
		// Length check
		if (password.length >= 8) score++;
		
		// Complexity check (count character types)
		let types = 0;
		if (/[a-z]/.test(password)) types++;
		if (/[A-Z]/.test(password)) types++;
		if (/[0-9]/.test(password)) types++;
		if (/[^A-Za-z0-9]/.test(password)) types++;
		
		if (types >= 3) score++;
		
		// Unique character check
		const uniqueChars = new Set(password.split('')).size;
		if (uniqueChars >= 6) score++;
		
		setPasswordStrength(score);
	}, [password]);
	
	const validateForm = () => {
		let isValid = true;
		setUsernameError('');
		setEmailError('');
		setPasswordError('');
		setConfirmPasswordError('');
		setGeneralError('');
		
		// Validate username
		const usernameValidation = validateUsername(username);
		if (!usernameValidation.valid) {
			setUsernameError(usernameValidation.message);
			isValid = false;
		}
		
		// Validate email
		const emailValidation = validateEmail(email);
		if (!emailValidation.valid) {
			setEmailError(emailValidation.message);
			isValid = false;
		}
		
		// Validate password
		const passwordValidation = validatePassword(password);
		if (!passwordValidation.valid) {
			setPasswordError(passwordValidation.message);
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
			await register(username, email, password, confirmPassword);
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
	
	// Toggle password visibility
	const togglePasswordVisibility = () => {
		setShowPassword(!showPassword);
	};
	
	// Input change handlers with length limits for security
	const handleUsernameChange = (e) => {
		const value = e.target.value.slice(0, 20); // Limit to 20 chars
		setUsername(value);
		
		if (usernameError) {
			const validation = validateUsername(value);
			if (validation.valid) {
				setUsernameError('');
			}
		}
	};
	
	const handleEmailChange = (e) => {
		const value = e.target.value.slice(0, 100); // Limit to 100 chars
		setEmail(value);
		
		if (emailError) {
			const validation = validateEmail(value);
			if (validation.valid) {
				setEmailError('');
			}
		}
	};
	
	const handlePasswordChange = (e) => {
		const value = e.target.value.slice(0, 128); // Limit to 128 chars
		setPassword(value);
		
		if (passwordError) {
			const validation = validatePassword(value);
			if (validation.valid) {
				setPasswordError('');
			}
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
	
	// Get strength indicator class
	const getStrengthClass = () => {
		if (password.length === 0) return '';
		switch (passwordStrength) {
			case 0: return 'strength-weak';
			case 1: return 'strength-fair';
			case 2: return 'strength-good';
			case 3: return 'strength-strong';
			default: return '';
		}
	};
	
	// Get strength indicator text
	const getStrengthText = () => {
		if (password.length === 0) return '';
		switch (passwordStrength) {
			case 0: return 'Weak';
			case 1: return 'Fair';
			case 2: return 'Good';
			case 3: return 'Strong';
			default: return '';
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
							type={showPassword ? "text" : "password"}
							value={password}
							onChange={handlePasswordChange}
							className={passwordError ? 'input-error' : ''}
							aria-invalid={!!passwordError}
							aria-describedby={passwordError ? 'password-error' : undefined}
							required
							autoComplete="new-password"
							placeholder="Minimum 8 characters"
							maxLength={128}
						/>
						{password && (
							<div className={`password-strength ${getStrengthClass()}`}>
								<div className="strength-bar">
									<div className="strength-indicator" style={{ width: `${(passwordStrength / 3) * 100}%` }}></div>
								</div>
								<span className="strength-text">{getStrengthText()}</span>
							</div>
						)}
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
							type={showPassword ? "text" : "password"}
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
					
					<div className="form-group checkbox">
						<input
							id="show-password"
							type="checkbox"
							checked={showPassword}
							onChange={togglePasswordVisibility}
						/>
						<label htmlFor="show-password">Show password</label>
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