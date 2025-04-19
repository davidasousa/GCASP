import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import VideoGrid from '../components/VideoGrid';

const HomePage = () => {
	const { isAuthenticated, isOfflineMode } = useAuth();
	const [videos, setVideos] = useState([]);
	const [currentPage, setCurrentPage] = useState(1);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [showUploadConfirm, setShowUploadConfirm] = useState(false);
	const [notification, setNotification] = useState({
		visible: false,
		message: '',
		type: 'success' // 'success' or 'error'
	});
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
			setNotification({
				visible: true,
				message: 'Failed to load videos',
				type: 'error'
			});
		}
	};

    // Show delete confirmation dialog
    const promptDeleteAllClips = () => {
        setShowDeleteConfirm(true);
    };

	// Handle clearing all clips after confirmation
	const handleClearClips = async () => {
		try { 
			await window.electron.removeLocalClips(); 
			loadVideos();
			setShowDeleteConfirm(false);
			setNotification({
				visible: true,
				message: 'All clips deleted successfully',
				type: 'success'
			});
		} catch (error) { 
			console.error('Error clearing clips:', error); 
			setShowDeleteConfirm(false);
			setNotification({
				visible: true,
				message: 'Failed to delete all clips',
				type: 'error'
			});
		}
	};

	// Cancel delete operation
	const cancelDelete = () => {
		setShowDeleteConfirm(false);
	};

	// Handle notification close
	const handleCloseNotification = () => {
		setNotification({ ...notification, visible: false });
	};

	// Load videos when the component mounts
	useEffect(() => {
		loadVideos();
		
		// Clear notification after 3 seconds
		if (notification.visible) {
			const timer = setTimeout(() => {
				handleCloseNotification();
			}, 3000);
			return () => clearTimeout(timer);
		}
	}, [notification.visible]);

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
		<div className="home-page">
			<div className="page-header">
				<h1>My Clips</h1>
				{isOfflineMode && (
					<div className="offline-banner">
						<span className="offline-icon">⚠️</span>
						<span>You are in Offline Mode. Social features are disabled.</span>
					</div>
				)}
			</div>
			
			<div className="button-group">
				<button className="refresh-button" onClick={loadVideos}>
					Refresh Videos
				</button>
				
				{/* Only show delete all button if there are videos */}
				{videos.length > 0 && (
					<button className="refresh-button" onClick={promptDeleteAllClips}>
						Delete All Recordings
					</button>
				)}
			</div>
			
			{/* Delete confirmation modal */}
			{showDeleteConfirm && (
				<div className="delete-modal">
					<div className="modal-content">
						<p>Are you sure you want to delete all recordings?</p>
						<div className="modal-buttons">
							<button onClick={cancelDelete} className="cancel-button">
								Cancel
							</button>
							<button onClick={handleClearClips} className="delete-button">
								Delete All
							</button>
						</div>
					</div>
				</div>
			)}
			
			{/* Notification component */}
			{notification.visible && (
				<div className={`notification ${notification.type}`}>
					{notification.message}
				</div>
			)}
			
			{videos.length > 0 ? (
				<div>
					<VideoGrid videos={currentVideos} onDelete={handleDeleteVideo} />
					{totalPages > 1 && (
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
					)}
				</div>
			) : (
				<div className="no-videos-message">
					<p>No Videos Available</p>
					<p className="help-text">Press your hotkey while gaming to create clips</p>
				</div>
			)}
		</div>
	);
};

export default HomePage;