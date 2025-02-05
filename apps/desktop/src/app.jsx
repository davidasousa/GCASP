import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import VideoGrid from './components/VideoGrid';
import './app.css';

// Importing IPC Handler
import { triggerIPC, triggerFetchVideo } from './triggerIPC';


const App = () => {
	const [currentView, setCurrentView] = useState('home');
	const [videos, setVideos] = useState([]);


	const getVideo = async (path) => {
		try {
			// Trigger the video fetch (if necessary)
			triggerFetchVideo(path);
			// Fetch the video from the server
			const response = await fetch('http://localhost:3001/video');
			const contentType = response.headers.get('Content-Type');
			if (!contentType || !contentType.includes('video/mp4')) {
				throw new Error('Invalid video format. Expected video/mp4 but received ' + contentType);
			} else {
				console.log('Valid video');
			}
			// Convert the response into a Blob and create an object URL
			const videoBlob = await response.blob();
			const videoURL = URL.createObjectURL(videoBlob); 
			return videoURL; // Return the video URL
		} catch (error) {
			console.error('Error fetching video:', error);
		}
	};
	useEffect(() => {
		const loadVideos = async () => {
		const videoURL = await getVideo('videos/output.mp4'); // Pass the appropriate path here
		const loadVideos = [
				{ id: 1, title: 'Video 1', videoUrl: videoURL },
			];
			setVideos(loadVideos);
		};
		loadVideos();
	}, []); // This runs only once on mount



	const frontPageUI = (
			<div className="app-container">
			<Sidebar currentView={currentView} onChangeView={setCurrentView} />
			<div className="main-content">
			{currentView === 'home' && <VideoGrid videos={videos}/>}
			{currentView === 'shared' && <div>Shared Clips(Coming Soon)</div>}
			{currentView === 'settings' && <div>Settings (Coming Soon)</div>}
			</div>
			<div className="record-button">
			<button onClick={() => triggerIPC('trigger-record')}>
			Trigger IPC
			</button>
			</div>
			</div>
			);

	return frontPageUI;
};

export default App;
