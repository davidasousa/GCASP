// app.jsx
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import VideoGrid from './components/VideoGrid';

import { loadVideos } from './clientSideReq';
import { clipper, clipSettings } from './clipper';

import './app.css';

const App = () => {
    const [currentView, setCurrentView] = useState('home');
    const [videos, setVideos] = useState([]);
		let userClipSettings = new clipSettings(2);

    // Initial load of videos
		useEffect(() => { loadVideos(setVideos); }, []);

		// Clip Recordings
		clipper();

		// Handle new recordings
		/*
    useEffect(() => {
        const handleNewClipping = (newVideo) => {
            const processedVideo = {
                id: newVideo.id,
                title: newVideo.filename,
                videoUrl: `gcasp://${newVideo.id}/`
            };
            setVideos(prevVideos => [processedVideo, ...prevVideos]);
        };

        window.electron.onNewClipping(handleNewRecording);
    }, []);
		*/

    const handleRecord = async () => {
			try { await window.electron.triggerRecordVideo(); } 
			catch (error) { console.error('Error starting recording:', error); }
    };

    const handleClip = async () => {
			try { await window.electron.triggerClipVideo(userClipSettings); } 
			catch (error) { console.error('Error starting recording:', error); }
    };

    const removeLocalVideos = async () => {
			try { 
			await window.electron.removeLocalVideos(); 
			loadVideos(setVideos);
			} catch (error) { 
			console.error('Error starting recording:', error); 
			}
    };

		// Constant Recording
		setInterval(() => { handleRecord(); }, 5300); // FIX THIS

    return (
        <div className="app-container">
            <Sidebar currentView={currentView} onChangeView={setCurrentView} />
            <div className="main-content">
                {currentView === 'home' && (
                    videos.length > 0 
										? ( <VideoGrid videos={videos}/> ) 
										: ( <p>No Videos Available</p> )
                )}
                {currentView === 'shared' && <div>Shared Clips (Coming Soon)</div>}
                {currentView === 'settings' && <div>Settings (Coming Soon)</div>}
            </div>
            <div className="record-button">
                <button onClick={handleClip}>
                    Clip Screen
                </button>
                <button onClick={removeLocalVideos}>
                    Delete Stashed Videos
                </button>
            </div>
        </div>
    );
};

export default App;
