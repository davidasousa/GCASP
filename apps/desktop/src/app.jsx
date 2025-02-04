import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import VideoGrid from './components/VideoGrid';
import './App.css';

import videoFile from './resources/vlc-record-2023-12-26-03h19m50s-2023-12-26_00-29-13.mp4-.mp4';

const App = () => {
  const [currentView, setCurrentView] = useState('home');
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    const dummyVideos = [
      { id: 1, title: 'Video 1', videoUrl: videoFile },
      { id: 2, title: 'Video 2', videoUrl: videoFile },
      { id: 3, title: 'Video 3', videoUrl: videoFile },
      { id: 4, title: 'Video 4', videoUrl: videoFile },
      { id: 5, title: 'Video 5', videoUrl: videoFile },
      { id: 6, title: 'Video 6', videoUrl: videoFile },
      { id: 7, title: 'Video 7', videoUrl: videoFile },
    ];
    setVideos(dummyVideos);
  }, []);

  return (
    <div className="app-container">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />
      <div className="main-content">
        {currentView === 'home' && <VideoGrid videos={videos} />}
        {currentView === 'shared' && <div>Shared Clips (Coming Soon)</div>}
        {currentView === 'settings' && <div>Settings (Coming Soon)</div>}
      </div>
    </div>
  );
};

export default App;
