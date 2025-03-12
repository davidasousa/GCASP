import React, { useState, useRef, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import SharedPage from './pages/SharedPage';
import SettingsPage from './pages/SettingsPage';
import EditPage from './pages/EditPage';
import './app.css';

const App = () => {
	// State for clip creation
	const [isClipping, setIsClipping] = useState(false);
	
	// State for settings
	const [settings, setSettings] = useState(null);
	
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
		
		return () => {
			// No intervals to clear
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
			}
		} catch (error) {
			console.error("Error during clipping:", error);
			window.electron.log.error("Error during clipping", { error: error.toString() });
			setIsClipping(false);
		}
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
			</div>
		</Router>
	);
};

export default App;