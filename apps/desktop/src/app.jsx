import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import SharedPage from './pages/SharedPage';
import SettingsPage from './pages/SettingsPage';
import EditPage from './pages/EditPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import LoginModal from './components/LoginModal';
import Notification from './components/Notification';
import successSound from './resources/clip-success.mp3';
import errorSound from './resources/clip-error.mp3';
import hotkeySound from './resources/hotkey-press.mp3';
import './styles/index.css';

// Recording Manager component to control recording based on route
const RecordingManager = ({ children }) => {
	const location = useLocation();
	
	useEffect(() => {
		const isAuthRoute = location.pathname === '/login' || location.pathname === '/register';
		
		if (isAuthRoute) {
			// Stop recording for auth screens
			window.electron.stopRecording().catch(error => {
				console.error('Error stopping recording:', error);
				window.electron.log.error('Error stopping recording for auth screens', {
					error: error.toString()
				});
			});
		} else {
			// Start recording for main app
			window.electron.startRecording().catch(error => {
				console.error('Error starting recording:', error);
				window.electron.log.error('Error starting recording for main app', {
					error: error.toString()
				});
			});
		}
	}, [location.pathname]);
	
	return children;
};

// Main App component
const App = () => {
	return (
		<AuthProvider>
			<Router>
				<RecordingManager>
					<Routes>
						{/* Public routes */}
						<Route path="/login" element={<LoginPage />} />
						<Route path="/register" element={<RegisterPage />} />
						
						{/* Protected app routes */}
						<Route 
							path="/*" 
							element={
								<ProtectedRoute requiresAuth={true} allowOffline={true}>
									<AppLayout />
								</ProtectedRoute>
							} 
						/>
					</Routes>
				</RecordingManager>
			</Router>
		</AuthProvider>
	);
};

// Authenticated app layout with sidebar
const AppLayout = () => {
	// State for clip creation
	const [isClipping, setIsClipping] = useState(false);
	
	// State for settings
	const [settings, setSettings] = useState(null);
	
	// State for notification
	const [notification, setNotification] = useState({
		visible: false,
		message: '',
		type: 'success' // 'success' or 'error'
	});
	
	// Audio references
	const successAudioRef = useRef(null);
	const errorAudioRef = useRef(null);
	const hotkeyAudioRef = useRef(null);
	
	// Get auth context and login modal state
	const { showLoginModal, closeLoginModal } = useAuth();
	
	// Initialize audio elements
	useEffect(() => {
		// Create success sound
		successAudioRef.current = new Audio(successSound);
		successAudioRef.current.volume = 0.5; // Set volume to 50%
		
		// Create error sound
		errorAudioRef.current = new Audio(errorSound);
		errorAudioRef.current.volume = 0.5; // Set volume to 50%

		// Create hotkey sound
		hotkeyAudioRef.current = new Audio(hotkeySound);
		hotkeyAudioRef.current.volume = 0.25; // Set volume to 25%
		
		return () => {
			// Cleanup audio elements
			if (successAudioRef.current) {
				successAudioRef.current.pause();
				successAudioRef.current.src = '';
			}
			if (errorAudioRef.current) {
				errorAudioRef.current.pause();
				errorAudioRef.current.src = '';
			}
			if (hotkeyAudioRef.current) {
				hotkeyAudioRef.current.pause();
				hotkeyAudioRef.current.src = '';
			}
		};
	}, []);
	
	// Load settings on component mount
	useEffect(() => {
		const loadSettings = async () => {
			try {
				// Get settings once when component loads, using cached settings
				const settings = await window.electron.getSettings();
				
				if (settings) {
					console.log('Initial settings loaded');
					window.electron.log.info('Initial settings loaded');
					
					// Update state with initial settings
					setSettings(settings);
					console.log('Updating settings in App component', settings);
					window.electron.log.debug('Updating settings in App component', settings);
				}
			} catch (error) {
				console.error('Error loading settings:', error);
				window.electron.log.error('Error loading settings in App component', { error: error.toString() });
			}
		};
		
		loadSettings();
		
		// Add a listener for settings changes
		const handleSettingsChanged = (newSettings) => {
			console.log('Settings changed event received in App component', newSettings);
			window.electron.log.debug('Settings changed event received in App component', newSettings);
			if (newSettings) {
				setSettings(newSettings);
			}
		};
		
		window.electron.onSettingsChanged(handleSettingsChanged);
		
		return () => {
			// Cleanup if needed
		};
	}, []);
	
	// Listen for new recordings from the main process
	useEffect(() => {
		const handleNewRecording = (videoInfo) => {
			console.log('New recording received:', videoInfo);
			window.electron.log.info('New recording received', { videoInfo });
		};

		// Clip completion handler
		const handleClipDone = (filename) => {
			console.log('Clip created:', filename);
			window.electron.log.info('Clip created', { filename });
			setIsClipping(false);
			
			// Play success sound
			if (successAudioRef.current) {
				successAudioRef.current.currentTime = 0;
				successAudioRef.current.play().catch(err => {
					console.error('Error playing success sound:', err);
				});
			}
			
			// Show success notification
			setNotification({
				visible: true,
				message: 'Clip created successfully!',
				type: 'success'
			});
		};
		
		// Clip error handler
		const handleClipError = (errorData) => {
			console.error('Clip error:', errorData);
			window.electron.log.error('Clip error', { error: errorData });
			setIsClipping(false);
			
			// Play error sound
			if (errorAudioRef.current) {
				errorAudioRef.current.currentTime = 0;
				errorAudioRef.current.play().catch(err => {
					console.error('Error playing error sound:', err);
				});
			}
			
			// Show error notification
			setNotification({
				visible: true,
				message: `Clipping failed: ${errorData.error || 'Unknown error'}`,
				type: 'error'
			});
		};

		// Hotkey press handler
		const handleHotkeyPressed = () => {
			console.log('Hotkey pressed, playing sound');
			window.electron.log.info('Hotkey pressed, playing sound');
			
			// Play hotkey sound
			if (hotkeyAudioRef.current) {
				hotkeyAudioRef.current.currentTime = 0;
				hotkeyAudioRef.current.play().catch(err => {
					console.error('Error playing hotkey sound:', err);
				});
			}
		};

		// Register all event listeners
		window.electron.onNewRecording(handleNewRecording);
		window.electron.onClipDone(handleClipDone);
		window.electron.onClipError(handleClipError);
		window.electron.onHotkeyPressed(handleHotkeyPressed);
		
		return () => {
			// Remove all event listeners when component unmounts
			window.electron.onNewRecording(null);
			window.electron.onClipDone(null);
			window.electron.onClipError(null);
			window.electron.onHotkeyPressed(null);
		};
	}, []);

	// Handler for recording button - uses splicing approach
	const handleRecordClip = async () => {
		if (isClipping) {
			console.log("Already creating a clip");
			window.electron.log.warn("Record button clicked while already creating a clip");
			return;
		}
		
		setIsClipping(true);
		window.electron.log.info("Record clip button clicked");
		
		try {
			// Generate a timestamp for the clip
			const timestamp = new Date().toISOString()
				.replace(/[:.]/g, '-')
				.replace('T', '_')
				.replace('Z', '');
			
			// Use settings from state rather than loading from disk
			const clipSettings = {
				clipLength: settings?.recordingLength || 20
			};
			
			window.electron.log.debug("Creating clip with settings", clipSettings);
			
			// Trigger the clip creation
			const result = await window.electron.triggerClipVideo(timestamp, clipSettings);
			
			if (!result || !result.success) {
				console.error("Clipping failed:", result ? result.error : "Unknown error");
				window.electron.log.error("Clipping failed", { 
					error: result ? result.error : "Unknown error" 
				});
				setIsClipping(false);
				
				// Play error sound
				if (errorAudioRef.current) {
					errorAudioRef.current.currentTime = 0;
					errorAudioRef.current.play().catch(err => {
						console.error('Error playing error sound:', err);
					});
				}
				
				// Show error notification
				setNotification({
					visible: true,
					message: `Clipping failed: ${result ? result.error : "Unknown error"}`,
					type: 'error'
				});
			}
		} catch (error) {
			console.error("Error during clipping:", error);
			window.electron.log.error("Error during clipping", { error: error.toString() });
			setIsClipping(false);
			
			// Play error sound
			if (errorAudioRef.current) {
				errorAudioRef.current.currentTime = 0;
				errorAudioRef.current.play().catch(err => {
					window.electron.log.error('Error playing error sound:', err);
				});
			}
			
			// Show error notification
			setNotification({
				visible: true,
				message: `Error during clipping: ${error.message}`,
				type: 'error'
			});
		}
	};
	
	// Close notification
	const handleCloseNotification = () => {
		setNotification(prev => ({ ...prev, visible: false }));
	};

	return (
		<div className="app-container">
			<Sidebar />
			<main className="main-content">
				<Routes>
					{/* Home is available to all authenticated users, including offline */}
					<Route path="/" element={<HomePage />} />
					
					{/* Shared page requires authentication and is not available in offline mode */}
					<Route 
						path="/shared" 
						element={
							<ProtectedRoute requiresAuth={true} allowOffline={false}>
								<SharedPage />
							</ProtectedRoute>
						} 
					/>
					
					{/* Settings is available to all users */}
					<Route path="/settings" element={<SettingsPage />} />
					
					{/* Edit page requires authentication but works in offline mode */}
					<Route 
						path="/edit/:videoId" 
						element={
							<ProtectedRoute requiresAuth={true} allowOffline={true}>
								<EditPage />
							</ProtectedRoute>
						} 
					/>

					{/* Profile page requires authentication - Added Profile UI Branch */}
					<Route path="/profile" element={<ProfilePage />} />
					
					{/* Default redirect to home */}
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</main>
			<div className="record-button">
				<button onClick={handleRecordClip} disabled={isClipping}>
					{isClipping ? "Creating Clip..." : "Record Clip"}
				</button>
			</div>
			<Notification
				visible={notification.visible}
				message={notification.message}
				type={notification.type}
				onClose={handleCloseNotification}
			/>
			{showLoginModal && (
				<LoginModal onClose={closeLoginModal} />
			)}
		</div>
	);
};

export default App;