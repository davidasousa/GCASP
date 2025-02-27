import React, { useState, useEffect } from 'react';
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

	// Listen for new recordings from the main process
	useEffect(() => {
		const handleNewRecording = (videoInfo) => {
			console.log('New recording received:', videoInfo);
		};

		// Set up the event listener
		window.electron.onNewRecording(handleNewRecording);

		return () => {
		};
	}, []);

	// Handler for recording button
	const handleRecordNow = async () => {
		if (isClipping) {
			console.log("Already creating a clip");
			return;
		}
		
		setIsClipping(true);
		try {
			const result = await window.electron.triggerClipVideo();
			if (!result.success) {
				console.error("Clipping failed:", result.error);
			}
		} catch (error) {
			console.error("Error during clipping:", error);
		}
		setIsClipping(false);
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