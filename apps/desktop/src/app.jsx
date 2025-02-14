import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import VideoGrid from './components/VideoGrid';
import './app.css';
import { fetchVideo } from './fetchVideo';

// Call The Record Video IPC Function -> In Preload.JS
// Sends Message To Handler In Main
const recordVideo = async (_videoID) => {
	try { await window.electron.triggerRecordVideo(_videoID); } 
	catch (error) { console.error('Failed to trigger IPC:', error); }
};


let videoID = 1;
const App = () => {
	const [currentView, setCurrentView] = useState('home');
  const [videos, setVideos] = useState([]);
	
	const loaderFunc = (videoPath) => {
		// Load Video & Add To The Videos Array
		const loadVideos = async () => {
			try {
				const videoURL = await fetchVideo(videoPath, videoID);	
				const newVideo = { id: videoID, title: `Video${videoID}`, videoUrl: videoURL };			
				
				// Incrementing For The Next Video
				videoID++;
			
				// Adding Video To The Video Array
				setVideos((prevVideos) => [...prevVideos, newVideo]);
			} catch(error) {
				console.log(error);
				setVideos([]);
			}
		}

		loadVideos();
	}

	// Video Fetch Listener
	window.electron.onTriggerVideoFetch((videoPath) => {
			loaderFunc(videoPath, videoID);
	});
	
	// Defining The UI JSX
	const frontPageUI = (
		<div className="app-container">
			<Sidebar currentView={currentView} onChangeView={setCurrentView} />
					<div className="main-content">
						{currentView === 'home' && videos.length > 0 && <VideoGrid videos={videos}/>}
						{currentView === 'shared' && <div>Shared Clips(Coming Soon)</div>}
						{currentView === 'settings' && <div>Settings (Coming Soon)</div>}
				</div>
				<div className="record-button">
				<button onClick={() => recordVideo(videoID)}>
					Record Screen
				</button>
			</div>
		</div>
	);
	return frontPageUI;
};

export default App;
