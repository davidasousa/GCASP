import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { validateEmail } from '../utils/validation';
import '../styles/login-page.css';

const LoginPage = () => {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [rememberMe, setRememberMe] = useState(true);
	const [emailError, setEmailError] = useState('');
	const [passwordError, setPasswordError] = useState('');
	const [generalError, setGeneralError] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	
	const { login, toggleOfflineMode, isAuthenticated, error: authError } = useAuth();
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
	
	const validateForm = () => {
		let isValid = true;
		setEmailError('');
		setPasswordError('');
		setGeneralError('');
		
		// Validate email
		const emailValidation = validateEmail(email);
		if (!emailValidation.valid) {
			setEmailError(emailValidation.message);
			isValid = false;
		}
		
		// Validate password (just check if it's provided)
		if (!password) {
			setPasswordError('Password is required');
			isValid = false;
		}
		
		return isValid;
	};
	
	const handleLogin = async (e) => {
		e.preventDefault();
		
		// Reset errors
		setGeneralError('');
		
		// Validate form
		if (!validateForm()) {
			return;
		}
		
		setIsLoading(true);
		
		try {
			await login(email, password, rememberMe);
		} catch (error) {
			console.error('Login error:', error);
			setGeneralError(error.message || 'Invalid email or password');
		} finally {
			setIsLoading(false);
		}
	};
	
	const handleOfflineMode = () => {
		toggleOfflineMode(true);
		navigate('/');
	};
	
	const navigateToRegister = () => {
		navigate('/register');
	};
	
	// Handle input changes - prevent large input to avoid DoS
	const handleEmailChange = (e) => {
		const value = e.target.value.slice(0, 100); // Limit to 100 chars
		setEmail(value);
		
		// Real-time validation if there was an error
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
		
		// Clear error when user types
		if (passwordError && value) {
			setPasswordError('');
		}
	};
	
	return (
		<div className="login-page">
			<div className="login-container">
				<h2>Welcome to GCASP</h2>
				
				<form onSubmit={handleLogin} noValidate>
					{generalError && (
						<div className="error-message" role="alert">
							{generalError}
						</div>
					)}
					
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
							autoComplete="current-password"
							maxLength={128}
						/>
						{passwordError && (
							<div id="password-error" className="field-error">
								{passwordError}
							</div>
						)}
					</div>
					
					<div className="form-group checkbox">
						<input
							id="remember-me"
							type="checkbox"
							checked={rememberMe}
							onChange={(e) => setRememberMe(e.target.checked)}
						/>
						<label htmlFor="remember-me">Remember me</label>
					</div>
					
					<button 
						type="submit" 
						className="login-button"
						disabled={isLoading}
						aria-busy={isLoading}
					>
						{isLoading ? 'Logging in...' : 'Login'}
					</button>
				</form>
				
				<div className="login-footer">
					<p>Don't have an account?</p>
					<button 
						className="register-link" 
						onClick={navigateToRegister}
						type="button"
					>
						Create an account
					</button>
					<hr className="divider" />
					<button 
						className="offline-mode" 
						onClick={handleOfflineMode}
						type="button"
					>
						Continue in Offline Mode
					</button>
				</div>
			</div>
		</div>
	);
};

export default LoginPage;