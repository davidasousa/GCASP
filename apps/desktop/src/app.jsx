import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import VideoGrid from './components/VideoGrid';
import './app.css';

// Importing IPC Handler
import { triggerIPC, triggerFetchVideo } from './triggerIPC';

const App = () => {
  const [currentView, setCurrentView] = useState('home');
  const [videos, setVideos] = useState([]);

	// Loading Videos From Memory - Node IPC
	var video = triggerFetchVideo('./videos/output.mp4');
	var videoUrl = URL.createObjectURL(video);
	

	// Use Effect For Playing Videos
	useEffect(() => {
		const loadVideos = [
			{ id: 1, title: 'Video 1', videoUrl: video},
		];

		// Loading The Videos Into The Use State
		setVideos(loadVideos);
	}, []);

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
