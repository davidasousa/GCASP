import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import VideoGrid from './components/VideoGrid';

// Import CSS
import './app.css';

// Importing Client Side Requests
import { fetchVideo, recordVideo, fetchPrevVideos } from './clientSideReq';

const frontend = () => {
	const [currentView, setCurrentView] = useState('home');
	const [videos, setVideos] = useState([]);
	const [videoTimestamp, setVideoTimestamp] = useState(null);
	const [videoID, setVideoID] = useState(1);

	const loaderFunc = (videoTimestamp) => {
		// Load Video & Add To The Videos Array
		const loadVideos = async () => {
			try {
				const videoURL = await fetchVideo(videoTimestamp);	
				const newVideo = { id: videoID, title: `Video${videoID}`, videoUrl: videoURL };			

				setVideos((prevVideos) => [...prevVideos, newVideo]);
				setVideoID((prevID) => prevID + 1);	
			} catch(error) {
				console.log(error);
				setVideos([]);
			}
		}

		loadVideos();
	}

	useEffect(() => {
		if(videoTimestamp !== null) {
			loaderFunc(videoTimestamp);
		}
	}, [videoTimestamp]);

	// Video Fetch Listener
	window.electron.onTriggerVideoFetch((timestamp) => {
		setVideoTimestamp(timestamp);
	});

	// Defining The UI JSX
	const frontPageUI = (
		<div className="app-container">
			<Sidebar currentView={currentView} onChangeView={setCurrentView} />
			<div className="main-content">
				{currentView == 'home' && videos.length > 0 ? (
					videos.map((video) => (
						<div key={video.id} className="video-item">
							<h3>{video.title}</h3>
							<video width="400" controls>
							<source src={video.videoUrl} type="video/mp4" />
							Your browser does not support the video tag.
							</video>
						</div>
						)) 
					) : (
						<p>No Videos Currently</p>
				)}
				{currentView === 'shared' && <div>Shared Clips(Coming Soon)</div>}
				{currentView === 'settings' && <div>Settings (Coming Soon)</div>}
			</div>
			<div className="record-button">
				<button onClick={() => recordVideo()}>
				Record Screen
				</button>
			</div>
		</div>
	);
	return frontPageUI;
};

export default frontend;
