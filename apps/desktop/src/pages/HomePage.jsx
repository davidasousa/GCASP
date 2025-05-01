import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import VideoGrid from '../components/VideoGrid';

const HomePage = () => {
	// auth state
	const { isAuthenticated, isOfflineMode } = useAuth();

	// video & pagination state
	const [videos, setVideos] = useState([]);
	const [currentPage, setCurrentPage] = useState(1);

	// UI state
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [notification, setNotification] = useState({
		visible: false,
		message: '',
		type: 'success'
	});

	const videosPerPage = 10;
	const topRef = useRef(null);

	// Load videos from disk
	const loadVideos = async () => {
		try {
			const localVideos = await window.electron.getLocalVideos();
			localVideos.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
			const processed = localVideos.map(v => ({
				id: v.id,
				title: v.filename,
				filename: v.filename,      // keep the real filename
				videoUrl: `gcasp://${v.id.replace('clip_', '')}/`
			}));
			setVideos(processed);
			setCurrentPage(1);
		} catch (err) {
			console.error('Error loading videos:', err);
			setNotification({ visible: true, message: 'Failed to load videos', type: 'error' });
		}
	};

	// Delete a single video both on disk and in UI
	const handleDeleteVideo = async (id, filename) => {
		try {
			const res = await window.electron.removeSpecificVideo(filename);
			if (!res.success) throw new Error(res.error || 'Unknown error');
			setVideos(prev => prev.filter(v => v.id !== id));
			setNotification({ visible: true, message: 'Clip deleted', type: 'success' });
		} catch (err) {
			console.error('Delete failed:', err);
			setNotification({ visible: true, message: `Delete failed: ${err.message}`, type: 'error' });
		}
	};

	// Show delete all confirmation
	const promptDeleteAllClips = () => setShowDeleteConfirm(true);

	// Delete all clips
	const handleClearClips = async () => {
		try {
			await window.electron.removeLocalClips();
			loadVideos();
			setShowDeleteConfirm(false);
			setNotification({ visible: true, message: 'All clips deleted successfully', type: 'success' });
		} catch (err) {
			console.error('Error clearing clips:', err);
			setShowDeleteConfirm(false);
			setNotification({ visible: true, message: 'Failed to delete all clips', type: 'error' });
		}
	};

	const cancelDelete = () => setShowDeleteConfirm(false);
	const handleCloseNotification = () => setNotification(prev => ({ ...prev, visible: false }));

	// pagination calculations
	const indexOfLast = currentPage * videosPerPage;
	const indexOfFirst = indexOfLast - videosPerPage;
	const currentVideos = videos.slice(indexOfFirst, indexOfLast);
	const totalPages = Math.ceil(videos.length / videosPerPage);

	const handleNextPage = () => {
		if (currentPage < totalPages) {
			setCurrentPage(currentPage + 1);
			topRef.current?.scrollIntoView();
		}
	};

	const handlePrevPage = () => {
		if (currentPage > 1) {
			setCurrentPage(currentPage - 1);
			topRef.current?.scrollIntoView();
		}
	};

	useEffect(() => {
		loadVideos();
	}, []);

	useEffect(() => {
		if (notification.visible) {
			const t = setTimeout(handleCloseNotification, 3000);
			return () => clearTimeout(t);
		}
	}, [notification.visible]);

	return (
		<div className="home-page">
			<div ref={topRef}></div>
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
				{videos.length > 0 && (
					<button className="refresh-button" onClick={promptDeleteAllClips}>
						Delete All Recordings
					</button>
				)}
			</div>

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

			{notification.visible && (
				<div className={`notification ${notification.type}`}>
					{notification.message}
				</div>
			)}

			{videos.length > 0 ? (
				<>
					<VideoGrid
						videos={currentVideos}
						onDelete={id => {
							const video = videos.find(v => v.id === id);
							if (video) handleDeleteVideo(id, video.filename);
						}}
					/>
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
				</>
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
