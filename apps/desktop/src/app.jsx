import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import VideoGrid from './components/VideoGrid';

import { loadVideos } from './clientSideReq';
import { clipper } from './clipper';

import './app.css';

const App = () => {
    const [currentView, setCurrentView] = useState('home');
    const [videos, setVideos] = useState([]);

    const [currentPage, setCurrentPage] = useState(1);
    const videosPerPage = 10;

    // Function to load videos from the folder.
    const loadVideos = async () => {
        try {
            const localVideos = await window.electron.getLocalVideos();
            // Sort videos by timestamp in descending order (newest first)
            localVideos.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            const processedVideos = localVideos.map(video => ({
                id: video.id,
                title: video.filename,
                videoUrl: `gcasp://${video.id.replace('clip_', '')}/`
            }));
            setVideos(processedVideos);
            setCurrentPage(1); // Reset to first page after refresh
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
  
    // Initial load of videos
		// useEffect(() => { loadVideos(setVideos); }, []);

    const handleClearRecordings = async () => {
			try { 
			await window.electron.removeLocalVideos(); 
			loadVideos(setVideos);
			} catch (error) { 
			console.error('Error starting recording:', error); 
			}
    };

    const handleClip = async () => {
    };

    const handleDeleteVideo = (id) => {
        setVideos(prevVideos => prevVideos.filter(video => video.id !== id));
    };

    // Calculate slice of videos to show on current page.
    const indexOfLastVideo = currentPage * videosPerPage;
    const indexOfFirstVideo = indexOfLastVideo - videosPerPage;
    const currentVideos = videos.slice(indexOfFirstVideo, indexOfLastVideo);
    const totalPages = Math.ceil(videos.length / videosPerPage);

    // Handlers to navigate pages.
    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

		// Creating The Clipper Object & Starting The Recording
		let programClipper = new clipper(5);
		programClipper.runClipper();

		// JSX Element
		return (
			<div className="app-container">
				<Sidebar currentView={currentView} onChangeView={setCurrentView} />
				<div className="main-content">
					{currentView === 'home' && (
						<div>
							<button className="refresh-button" onClick={loadVideos}>
								Refresh Videos
							</button>
							<button className = "Clip Recording" onClick={handleClip}>
								Record Clip
							</button>
							<button className = "Clear Recordings" onClick={handleClearRecordings}>
								Delete All Recordings
							</button>

							{videos.length > 0 ? (
								<div>
									<VideoGrid videos={currentVideos} onDelete={handleDeleteVideo} />
									<div className="pagination">
										<button onClick={handlePrevPage} disabled={currentPage === 1}>
											Previous
										</button>
										<span>
											Page {currentPage} of {totalPages}
										</span>
										<button onClick={handleNextPage} disabled={currentPage === totalPages}>
											Next
										</button>
									</div>
								</div>
							) : (
								<p>No Videos Available</p>
							)}

						</div>
					)}
					{currentView === 'shared' && <div>Shared Clips (Coming Soon)</div>}
					{currentView === 'settings' && <div>Settings (Coming Soon)</div>}
				</div>
			</div>
		);
		// End JSX Element
};

export default App;
