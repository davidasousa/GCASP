import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import SharedPage from './pages/SharedPage';
import SettingsPage from './pages/SettingsPage';
import './app.css';

const App = () => {
    // Listen for new recordings from the main process
    useEffect(() => {
        const handleNewRecording = (videoInfo) => {
            console.log('New recording received:', videoInfo);

        };

        // Set up the event listener
        window.electron.onNewRecording(handleNewRecording);

        // Cleanup on component unmount
        return () => {

        };
    }, []);

    const handleRecord = async () => {
        try {
            await window.electron.triggerRecordVideo();
        } catch (error) {
            console.error('Error starting recording:', error);
        }
    };

    return (
        <Router>
            <div className="app-container">
                <Sidebar />
                <main className="main-content">
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/shared" element={<SharedPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                    </Routes>
                </main>
                <div className="record-button">
                    <button onClick={handleRecord}>Record Screen</button>
                </div>
            </div>
        </Router>
    );
};

export default App;