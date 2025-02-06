import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import VideoGrid from './components/VideoGrid';
import './app.css';

// Importing IPC Handler
import { triggerIPC } from './triggerIPC';
import { fetchVideo } from './fetchVideo';

const videoPath = 'videos/output.mp4';

const App = () => {
	const [currentView, setCurrentView] = useState('home');
	const [videos, setVideos] = useState([]);
	
	useEffect(() => {
		const loadVideos = async () => {
			try {
				const videoURL = await fetchVideo(videoPath);
				const videoArray = [ 
					{ id: 1, title: 'Video 1', videoUrl: videoURL }, 
				];
				setVideos(videoArray);
			} catch(error) {
				console.log(error);
				setVideos(null);
			}
		}

		loadVideos();
	}, []); 

	const frontPageUI = (
		<div className="app-container">
			<Sidebar currentView={currentView} onChangeView={setCurrentView} />
					<div className="main-content">
						{currentView === 'home' && videos != null && <VideoGrid videos={videos}/>}
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
