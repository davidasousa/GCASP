import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import VideoGrid from './components/VideoGrid';
import './app.css';
import { fetchVideo } from './fetchVideo';

let videoID = 1;

const recordVideo = async (video_number) => {
	try { await window.electron.triggerRecordVideo(video_number); } 
	catch (error) { console.error('Failed to trigger IPC:', error); }
};

const App = () => {
	const [currentView, setCurrentView] = useState('home');
	const [videos, setVideos] = useState([]);
	
	const loaderFunc = (videoPath) => {
		// Load Video & Add To The Videos Array
		const loadVideos = async () => {
			try {
				const videoURL = await fetchVideo(videoPath, videoID);	
				const newVideo = [{ id: videoID, title: `Video${videoID}`, videoUrl: videoURL }];			
				videoID++;
				console.log(videoPath);

				setVideos(videos.concat(newVideo));
			} catch(error) {
				// Catch Errors & Set Null
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
						{currentView === 'home' && videos != [] && <VideoGrid videos={videos}/>}
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
