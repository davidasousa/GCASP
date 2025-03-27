import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import SharedPage from './pages/SharedPage';
import SettingsPage from './pages/SettingsPage';
import EditPage from './pages/EditPage';
import Notification from './components/Notification';
import successSound from './resources/clip-success.mp3';
import errorSound from './resources/clip-error.mp3';
import hotkeySound from './resources/hotkey-press.mp3';
import './styles/index.css';

const App = () => {
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

		};
	}, []);
	
	// Listen for new recordings from the main process
	useEffect(() => {
		const handleNewRecording = (videoInfo) => {
			console.log('New recording received:', videoInfo);
			window.electron.log.info('New recording received', { videoInfo });
		};

		// Set up the event listener
		window.electron.onNewRecording(handleNewRecording);
		
		// Listen for clip completion
		window.electron.onClipDone((filename) => {
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
		});
		
		// Add this new event listener for clip errors
		window.electron.onClipError((errorData) => {
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
		});

		window.electron.onHotkeyPressed(() => {
			console.log('Hotkey pressed, playing sound');
			window.electron.log.info('Hotkey pressed, playing sound');
			
			// Play hotkey sound
			if (hotkeyAudioRef.current) {
				hotkeyAudioRef.current.currentTime = 0;
				hotkeyAudioRef.current.play().catch(err => {
					console.error('Error playing hotkey sound:', err);
				});
			}
		});
		
		return () => {
			// Cleanup would go here if needed
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
		<Router>
			<div className="app-container">
				<Sidebar />
				<main className="main-content">
					<Routes>
						<Route path="/" element={<HomePage />} />
						<Route path="/shared" element={<SharedPage />} />
						<Route path="/settings" element={<SettingsPage />} />
						<Route path="/edit/:videoId" element={<EditPage />} />
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
			</div>
		</Router>
	);
};

export default App;