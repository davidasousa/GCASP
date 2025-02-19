// app.jsx
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import VideoGrid from './components/VideoGrid';

import './app.css';

const App = () => {
    const [currentView, setCurrentView] = useState('home');
    const [videos, setVideos] = useState([]);

    // Define a function to load videos manually.
    const loadVideos = async () => {
        try {
            const localVideos = await window.electron.getLocalVideos();
            const processedVideos = localVideos.map(video => ({
                id: video.id,
                title: video.filename,
                videoUrl: `gcasp://${video.id.replace('clip_', '')}/`
            }));
            setVideos(processedVideos);
        } catch (error) {
            console.error('Error loading videos:', error);
        }
    };

    // Load videos when the component mounts or when the home view is selected.
    useEffect(() => {
        if (currentView === 'home') {
            loadVideos();
        }
    }, [currentView]);

    const handleRecord = async () => {
        try {
            await window.electron.triggerRecordVideo();
        } catch (error) {
            console.error('Error starting recording:', error);
        }
    };

    return (
        <div className="app-container">
            <Sidebar currentView={currentView} onChangeView={setCurrentView} />
            <div className="main-content">
                {currentView === 'home' && (
                    <div>
                        <button onClick={loadVideos}>Refresh Videos</button>
                        {videos.length > 0 ? (
                            <VideoGrid videos={videos} />
                        ) : (
                            <p>No Videos Available</p>
                        )}
                    </div>
                )}
                {currentView === 'shared' && <div>Shared Clips (Coming Soon)</div>}
                {currentView === 'settings' && <div>Settings (Coming Soon)</div>}
            </div>
            <div className="record-button">
                <button onClick={handleRecord}>
                    Record Screen
                </button>
            </div>
        </div>
    );
};

export default App;
