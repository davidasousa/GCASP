import React, { useState, useRef, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import SharedPage from './pages/SharedPage';
import SettingsPage from './pages/SettingsPage';
import EditPage from './pages/EditPage';
import './app.css';

const App = () => {
	// Creating The Clipper Object
	const clipLength = 5;
	const clipWindow = [];
	const [captureFlag, setCaptureFlag] = useState(false);
	const captureFlagRef = useRef(captureFlag);
	
	useEffect(() => { 
		captureFlagRef.current = captureFlag; 
	}, [captureFlag]);

	// Listen for new recordings from the main process
	useEffect(() => {
		const handleNewRecording = (videoInfo) => {
			console.log('New recording received:', videoInfo);
		};

		// Set up the event listener
		window.electron.onNewRecording(handleNewRecording);

		// Core Recording + Clipping Loop
		const startRecordingLoop = () => {
			console.log("Starting recording loop");
			const loop = async () => {
				try {
					// Get New Video
					const videoInfo = await window.electron.triggerRecordVideo(); 

					// Remove last video if buffer is full
					if (clipWindow.length > 5) {
						throw new Error("Clip Window Length Exceeded");
					} else if (clipWindow.length === 5) {
						const file = clipWindow[0].filename;
						await window.electron.removeSpecificVideo(file);
						clipWindow.shift();
					}
					
					// Add New Video To Buffer
					clipWindow.push(videoInfo);
					
					// Clipping Video if flag is set
					if (captureFlagRef.current) {
						await window.electron.triggerClipVideo(clipLength);
						setCaptureFlag(false);
					}
					
					// Continue the loop
					setTimeout(loop, 5); // 5ms delay between recordings
				} catch (error) {
					console.error("Recording loop error:", error);
					// Continue despite errors
					setTimeout(loop, 1000);
				}
			};
			
			loop();
		};

		// Start the recording loop
		startRecordingLoop();

		// No cleanup needed for loop - it will continue running
		return () => {
			// Any cleanup if needed
		};
	}, []);

	// Handler for recording button
	const handleRecordNow = () => {
		if (captureFlagRef.current === true) {
			console.log("Error: Clipping already in process");
			return;
		}
		setCaptureFlag(true);
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
			</div>
		</Router>
	);
};

export default App;