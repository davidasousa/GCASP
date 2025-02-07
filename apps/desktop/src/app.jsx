import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import VideoGrid from './components/VideoGrid';
import './app.css';

// Importing IPC Handler
import { triggerIPC } from './triggerIPC';
import { fetchVideo } from './fetchVideo';

var videoPath = 'videos/output.mp4';
var videoID = 1;

const App = () => {
	const [currentView, setCurrentView] = useState('home');
	const [videos, setVideos] = useState(null);
	
	const loaderFunc = () => {
		// Load Video & Add To The Videos Array
		const loadVideos = async () => {
			try {
				const videoURL = await fetchVideo(videoPath);	
				const videoArray = [{ id: videoID++, title: 'Video', videoUrl: videoURL }];			
				setVideos((videos) => videos ? videos.concat(videoArray) : videoArray);	
			} catch(error) {
				// Catch Errors & Set Null
				console.log(error);
				setVideos(null);
			}
		}
		loadVideos();
	}

	// Defining The Video Listener Anonymous Function
	const videoFetchListener = (videoPath) => {
	
		loaderFunc();
    console.log('new video');
  };

  window.electron.onTriggerVideoFetch(videoFetchListener);

	// Defining The UI JSX
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
