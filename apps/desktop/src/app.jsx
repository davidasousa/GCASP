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
	const [clipLength, setClipLength] = useState(20); // Default clip length in seconds
	
	// Load settings on component mount
	useEffect(() => {
		const loadSettings = async () => {
			try {
				const settings = await window.electron.getSettings();
				if (settings) {
					setClipLength(settings.recordingLength || 20);
				}
			} catch (error) {
				console.error('Error loading settings:', error);
			}
		};
		
		loadSettings();
		
		// Listen for settings changes
		const settingsInterval = setInterval(loadSettings, 5000);
		
		return () => {
			clearInterval(settingsInterval);
		};
	}, []);
	
	// Listen for new recordings from the main process
	useEffect(() => {
		const handleNewRecording = (videoInfo) => {
			console.log('New recording received:', videoInfo);
		};

		// Set up the event listener
		window.electron.onNewRecording(handleNewRecording);
		
		// Listen for clip completion
		window.electron.onClipDone((filename) => {
			console.log('Clip created:', filename);
			setIsClipping(false);
		});
		
		return () => {
			// Cleanup would go here if needed
		};
	}, []);

	// Handler for recording button - uses splicing approach
	const handleRecordNow = async () => {
		if (isClipping) {
			console.log("Already creating a clip");
			return;
		}
		
		setIsClipping(true);
		
		try {
			// Generate a timestamp for the clip
			const timestamp = new Date().toISOString()
				.replace(/[:.]/g, '-')
				.replace('T', '_')
				.replace('Z', '');
			
			// Create the clip settings
			const clipSettings = {
				clipLength: clipLength
			};
			
			// Trigger the clip creation
			const result = await window.electron.triggerClipVideo(timestamp, clipSettings);
			
			if (!result || !result.success) {
				console.error("Clipping failed:", result ? result.error : "Unknown error");
				setIsClipping(false);
			}
		} catch (error) {
			console.error("Error during clipping:", error);
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
					<button onClick={handleRecordNow} disabled={isClipping}>
						{isClipping ? "Creating Clip..." : "Record Clip"}
					</button>
				</div>
			</div>
		</Router>
	);
};

export default App;