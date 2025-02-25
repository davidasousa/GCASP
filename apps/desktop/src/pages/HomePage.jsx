import React, { useState, useEffect } from 'react';
import VideoGrid from '../components/VideoGrid';

const HomePage = () => {
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

    // Handle clearing all clips
    const handleClearClips = async () => {
        try { 
            await window.electron.removeLocalClips(); 
            loadVideos();
        } catch (error) { 
            console.error('Error clearing clips:', error); 
        }
    };

    // Load videos when the component mounts
    useEffect(() => {
        loadVideos();
    }, []);

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

    return (
        <div>
            <div className="button-group">
                <button className="refresh-button" onClick={loadVideos}>
                    Refresh Videos
                </button>
                <button className="refresh-button" onClick={() => window.electron.triggerClipVideo(5)}>
                    Record Clip
                </button>
                <button className="refresh-button" onClick={handleClearClips}>
                    Delete All Recordings
                </button>
            </div>
            
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
    );
};

export default HomePage;