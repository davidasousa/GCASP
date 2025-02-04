import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import VideoGrid from './components/VideoGrid';
import './app.css';

// Importing IPC Handler
import { triggerIPC } from './triggerIPC';

const App = () => {
  const [currentView, setCurrentView] = useState('home');
  const [videos, setVideos] = useState([]);

	const frontPageUI = (
    <div className="app-container">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} />
      <div className="main-content">
        {currentView === 'shared' && <div>Shared Clips(Coming Soon)</div>}
        {currentView === 'settings' && <div>Settings (Coming Soon)</div>}
      </div>
			<div className="record-button">
				<button onClick={ triggerIPC }>Trigger IPC</button>
			</div>
    </div>
	);

  return frontPageUI;
};

export default App;
