import React, { useState, useEffect } from 'react';
import { secureStorage } from '../utils/secureStorage';
import API from '../services/api_index';
import VideoGrid from '../components/VideoGrid';
import '../styles/shared-page.css';

const SharedPage = () => {
	const [videos, setVideos] = useState([]);
	const [currentPage, setCurrentPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true); // Start as loading
	const [currentUser, setCurrentUser] = useState(null);
	const [notification, setNotification] = useState({
		visible: false,
		message: '',
		type: 'success' // 'success' or 'error'
	});
	const [showMetadataId, setShowMetadataId] = useState(null);
	const [activeCategory, setActiveCategory] = useState('all');
	const [userDataLoaded, setUserDataLoaded] = useState(false);
	const [filteredVideos, setFilteredVideos] = useState([]);

	// Pagination settings
	const videosPerPage = 10;

	// Handle notifications timing
	useEffect(() => {
		if (notification.visible) {
			const timer = setTimeout(() => {
				setNotification({ ...notification, visible: false });
			}, 3000);
			return () => clearTimeout(timer);
		}
	}, [notification.visible]);

	// Get current user data first (important to do this before loading videos)
	useEffect(() => {
		const getCurrentUser = async () => {
			try {
				const user = await secureStorage.getUser();
				setCurrentUser(user);
			} catch (error) {
				console.error('Error getting current user:', error);
			} finally {
				setUserDataLoaded(true); // Mark user data as loaded
			}
		};
		
		getCurrentUser();
	}, []);

	// Function to load shared videos from the server
	const fetchSharedVideos = async () => {
		setIsLoading(true);
		try {
			// First ensure we have user data
			if (!userDataLoaded) {
				await new Promise(resolve => {
					const checkInterval = setInterval(() => {
						if (userDataLoaded) {
							clearInterval(checkInterval);
							resolve();
						}
					}, 100);
				});
			}
			
			const sharedVideos = await API.getSharedVideos();
			
			// Process the videos to add extra information needed for display
			const processedVideos = sharedVideos.map(video => {
				// Explicitly check username equality for ownership
				const isOwnVideo = currentUser && 
					currentUser.username && 
					video.username && 
					currentUser.username.toLowerCase() === video.username.toLowerCase();
				
				return {
					id: video.id,
					title: video.title || video.filename,
					videoUrl: video.videoUrl,
					username: video.username,
					resolution: video.resolution,
					duration: video.duration,
					size: video.size,
					createdAt: video.createdAt,
					isOwnVideo // Track if this is the current user's video
				};
			});
			
			setVideos(processedVideos);
			setCurrentPage(1); // Reset to page 1 when loading new videos
			setNotification({
				visible: true,
				message: 'Videos loaded successfully',
				type: 'success'
			});
		} catch (error) {
			console.error('Error loading shared videos:', error);
			setNotification({
				visible: true,
				message: 'Failed to load videos',
				type: 'error'
			});
		} finally {
			setIsLoading(false);
		}
	};

	// Load videos after user data is loaded
	useEffect(() => {
		if (userDataLoaded) {
			fetchSharedVideos();
		}
	}, [userDataLoaded]);

	// Filter videos when category or videos array changes
	useEffect(() => {
		let filtered;
		if (activeCategory === 'all') {
			filtered = videos;
		} else if (activeCategory === 'my-videos') {
			filtered = videos.filter(video => video.isOwnVideo);
		} else {
			filtered = videos;
		}
		
		setFilteredVideos(filtered);
		// Always reset to page 1 when the filter changes
		setCurrentPage(1);
	}, [activeCategory, videos]);

	// Handle category change
	const handleCategoryChange = (category) => {
		setActiveCategory(category);
		// No need to reset page here as it's handled in the useEffect
	};

	// Handle delete action
	const handleDeleteVideo = async (id) => {
		try {
			const token = await secureStorage.getToken();
			await API.deleteVideo(id, token);
			
			// Remove the deleted video from the state
			setVideos(prevVideos => prevVideos.filter(video => video.id !== id));
			
			setNotification({
				visible: true,
				message: 'Video deleted successfully',
				type: 'success'
			});
		} catch (error) {
			console.error('Error deleting video:', error);
			setNotification({
				visible: true,
				message: 'Failed to delete video',
				type: 'error'
			});
		}
	};

	// Toggle showing video metadata
	const toggleMetadata = (id) => {
		setShowMetadataId(showMetadataId === id ? null : id);
	};

	// Calculate pagination
	const indexOfLastVideo = currentPage * videosPerPage;
	const indexOfFirstVideo = indexOfLastVideo - videosPerPage;
	// Make sure we don't try to slice beyond the array bounds
	const currentVideos = filteredVideos.slice(indexOfFirstVideo, indexOfLastVideo);
	const totalPages = Math.max(1, Math.ceil(filteredVideos.length / videosPerPage));

	// Ensure current page is within valid bounds
	useEffect(() => {
		if (currentPage > totalPages && totalPages > 0) {
			setCurrentPage(totalPages);
		}
	}, [currentPage, totalPages]);

	// Process videos into the format expected by VideoGrid
	const gridVideos = currentVideos.map(video => {
		return {
			id: video.id,
			title: video.title,
			videoUrl: video.videoUrl,
			username: video.username,
			isOwnVideo: video.isOwnVideo, // Pass true or false, never undefined
			isSharedVideo: true, // Explicitly mark as shared video
			metadata: {
				resolution: video.resolution,
				duration: video.duration,
				size: video.size,
				createdAt: video.createdAt
			},
			showMetadata: showMetadataId === video.id,
			toggleMetadata: () => toggleMetadata(video.id)
		};
	});

	// Handlers to navigate pages
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

	// Notification handlers
	const handleCloseNotification = () => {
		setNotification({ ...notification, visible: false });
	};

	return (
		<div className="shared-page">
			<div className="page-header">
				<h1>Shared Clips</h1>
			</div>
			
			<div className="category-selector">
				<button 
					className={`category-pill ${activeCategory === 'all' ? 'active' : ''}`}
					onClick={() => handleCategoryChange('all')}
				>
					All Videos
				</button>
				<button 
					className={`category-pill ${activeCategory === 'my-videos' ? 'active' : ''}`}
					onClick={() => handleCategoryChange('my-videos')}
				>
					My Videos
				</button>
			</div>
			
			<div className="button-group">
				<button 
					className="refresh-button" 
					onClick={fetchSharedVideos}
					disabled={isLoading}
				>
					{isLoading ? 'Loading...' : 'Refresh Videos'}
				</button>
			</div>
			
			{/* Notification component */}
			{notification.visible && (
				<div className={`notification ${notification.type}`}>
					{notification.message}
				</div>
			)}
			
			{isLoading ? (
				<div className="loading-container">
					<div className="loading-spinner"></div>
					<p>Loading videos...</p>
				</div>
			) : filteredVideos.length > 0 ? (
				<div>
					<VideoGrid 
						videos={gridVideos} 
						onDelete={handleDeleteVideo}
						renderUsername={true}
						renderInfo={true}
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
				</div>
			) : (
				<div className="no-videos-message">
					<p>No Shared Videos Available</p>
					{activeCategory === 'my-videos' && (
						<p className="help-text">You haven't uploaded any videos yet</p>
					)}
				</div>
			)}
		</div>
	);
};

export default SharedPage;