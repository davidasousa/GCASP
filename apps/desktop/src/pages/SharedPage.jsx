import React, { useState, useEffect } from 'react';
import { secureStorage } from '../utils/secureStorage';
import API from '../services/api_index';
import VideoGrid from '../components/VideoGrid';
import '../styles/shared-page.css';

const SharedPage = () => {
	const [videos, setVideos] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [currentUser, setCurrentUser] = useState(null);
	const [notification, setNotification] = useState({
		visible: false,
		message: '',
		type: 'success'
	});
	const [showMetadataId, setShowMetadataId] = useState(null);
	const [activeCategory, setActiveCategory] = useState('all');
	const [userDataLoaded, setUserDataLoaded] = useState(false);
	const [filteredVideos, setFilteredVideos] = useState([]);
	const [retryCount, setRetryCount] = useState(0);
	const [networkError, setNetworkError] = useState(false);
	
	// Server-side pagination state
	const [pagination, setPagination] = useState({
		currentPage: 1,
		totalPages: 1,
		totalCount: 0,
		pageSize: 10,
		hasNextPage: false,
		hasPreviousPage: false
	});

	// Handle notifications timing
	useEffect(() => {
		if (notification.visible) {
			const timer = setTimeout(() => {
				setNotification({ ...notification, visible: false });
			}, 3000);
			return () => clearTimeout(timer);
		}
	}, [notification.visible]);

	// Get current user data first
	useEffect(() => {
		const getCurrentUser = async () => {
			try {
				const user = await secureStorage.getUser();
				setCurrentUser(user);
			} catch (error) {
				console.error('Error getting current user:', error);
				window.electron?.log.error('Error getting current user', {
					error: error.toString()
				});
			} finally {
				setUserDataLoaded(true);
			}
		};
		
		getCurrentUser();
	}, []);

	// Function to load shared videos from the server with pagination
	const fetchSharedVideos = async (page = 1) => {
		// Don't retry immediately if already loading
		if (isLoading && retryCount > 0) return;
		
		setIsLoading(true);
		setNetworkError(false);
		
		try {
			// Wait for user data if needed
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
			
			// Get videos with pagination
			const result = await API.getSharedVideos(page, pagination.pageSize);
			
			if (!result || !result.videos) {
				throw new Error('Invalid response from server');
			}
			
			// Process the videos to add extra information needed for display
			const processedVideos = result.videos.map(video => {
				// Check for video ownership
				const isOwnVideo = currentUser && 
					currentUser.username && 
					video.username && 
					currentUser.username.toLowerCase() === video.username.toLowerCase();
				
				return {
					id: video.id,
					title: video.title || video.filename,
					videoUrl: video.videoUrl,
					cloudFrontUrl: video.cloudFrontUrl,
					username: video.username,
					resolution: video.resolution,
					duration: video.duration,
					size: video.size,
					createdAt: video.createdAt,
					uploadedAt: video.uploadedAt,
					isOwnVideo
				};
			});
			
			setVideos(processedVideos);
			setPagination(result.pagination);
			setRetryCount(0); // Reset retry counter on success
			
			setNotification({
				visible: true,
				message: 'Videos loaded successfully',
				type: 'success'
			});
		} catch (error) {
			console.error('Error loading shared videos:', error);
			window.electron?.log.error('Error loading shared videos', {
				error: error.toString()
			});
			
			// Handle network connectivity issues
			if (error.message && (
				error.message.includes('network') || 
				error.message.includes('connection') ||
				error.message.includes('timeout') ||
				error.message.includes('Failed to fetch') ||
				error.message.includes('TypeError')
			)) {
				setNetworkError(true);
			}
			
			setNotification({
				visible: true,
				message: 'Failed to load videos: ' + (error.message || 'Unknown error'),
				type: 'error'
			});
			
			// Only retry on network errors, not on JSON parsing or other errors
			if (networkError && retryCount < 2) {
				const nextRetryCount = retryCount + 1;
				window.electron?.log.debug(`Scheduling retry ${nextRetryCount} for video fetch`);
				
				// Use setTimeout for retry with increasing delay
				setTimeout(() => {
					setRetryCount(nextRetryCount);
					fetchSharedVideos(pagination.currentPage);
				}, 3000 * nextRetryCount); // 3s, 6s, etc.
			}
		} finally {
			setIsLoading(false);
		}
	};

	// Load videos after user data is loaded
	useEffect(() => {
		if (userDataLoaded) {
			fetchSharedVideos(1);
		}
	}, [userDataLoaded]);

	// Filter videos when category changes
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
	}, [activeCategory, videos]);

	// Handle category change
	const handleCategoryChange = (category) => {
		if (category === activeCategory) return;
		
		setActiveCategory(category);
		
		// If changing to 'my-videos', we can filter locally
		// If changing to 'all', we need to fetch from server again
		if (category === 'all' && activeCategory !== 'all') {
			fetchSharedVideos(1); // Reset to first page when switching to all
		}
	};

	// Handle page change
	const handlePageChange = (newPage) => {
		if (newPage === pagination.currentPage) return;
		
		// Fetch new page from server
		fetchSharedVideos(newPage);
		
		// Scroll to top
		window.scrollTo(0, 0);
	};

	// Handle delete action
	const handleDeleteVideo = async (id) => {
		try {
			const token = await secureStorage.getToken();
			await API.deleteVideo(id, token);
			
			// Remove from local state
			setVideos(prevVideos => prevVideos.filter(video => video.id !== id));
			setFilteredVideos(prevFiltered => prevFiltered.filter(video => video.id !== id));
			
			// Update pagination count
			setPagination(prev => ({
				...prev,
				totalCount: prev.totalCount - 1,
				totalPages: Math.max(1, Math.ceil((prev.totalCount - 1) / prev.pageSize))
			}));
			
			setNotification({
				visible: true,
				message: 'Video deleted successfully',
				type: 'success'
			});
		} catch (error) {
			console.error('Error deleting video:', error);
			window.electron?.log.error('Error deleting video', {
				error: error.toString()
			});
			
			// Check for token expiration
			if (error.message && error.message.includes('token')) {
				setNotification({
					visible: true,
					message: 'Your session has expired. Please log in again.',
					type: 'error'
				});
			} else {
				setNotification({
					visible: true,
					message: 'Failed to delete video: ' + (error.message || 'Unknown error'),
					type: 'error'
				});
			}
		}
	};

	// Handle CloudFront URL token expiration
	const handleVideoError = async (videoId) => {
		// Find the video with expired token
		const video = videos.find(v => v.id === videoId);
		if (!video) return;
		
		console.log(`Handling video error for ${videoId}, refreshing CloudFront URL`);
		window.electron?.log.debug(`Handling video error for ${videoId}`, {
			action: 'refreshing CloudFront URL'
		});
		
		// Request a fresh URL from the server
		try {
			// This assumes your API has a method to refresh URLs
			const refreshedVideo = await API.refreshVideoUrl(videoId);
			
			// Update the video in the list with the fresh URL
			setVideos(prevVideos => 
				prevVideos.map(v => 
					v.id === videoId 
						? { ...v, videoUrl: refreshedVideo.cloudFrontUrl || refreshedVideo.videoUrl }
						: v
				)
			);
			
			setFilteredVideos(prevFiltered => 
				prevFiltered.map(v => 
					v.id === videoId 
						? { ...v, videoUrl: refreshedVideo.cloudFrontUrl || refreshedVideo.videoUrl }
						: v
				)
			);
			
			window.electron?.log.info(`CloudFront URL refreshed for video ${videoId}`);
		} catch (err) {
			console.error('Error refreshing video URL:', err);
			window.electron?.log.error('Error refreshing CloudFront URL', {
				error: err.toString(),
				videoId
			});
		}
	};

	// Toggle showing video metadata
	const toggleMetadata = (id) => {
		setShowMetadataId(showMetadataId === id ? null : id);
	};

	// Process videos for VideoGrid
	const gridVideos = filteredVideos.map(video => {
		return {
			id: video.id,
			title: video.title,
			videoUrl: video.videoUrl,
			username: video.username,
			isOwnVideo: video.isOwnVideo,
			isSharedVideo: true,
			metadata: {
				resolution: video.resolution,
				duration: video.duration,
				size: video.size,
				createdAt: video.createdAt,
				uploadedAt: video.uploadedAt
			},
			showMetadata: showMetadataId === video.id,
			toggleMetadata: () => toggleMetadata(video.id),
			onVideoError: () => handleVideoError(video.id)
		};
	});

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
					onClick={() => fetchSharedVideos(pagination.currentPage)}
					disabled={isLoading}
				>
					{isLoading ? 'Loading...' : 'Refresh Videos'}
				</button>
			</div>
			
			{notification.visible && (
				<div className={`notification ${notification.type}`}>
					{notification.message}
				</div>
			)}
			
			{networkError && (
				<div className="network-error-banner">
					<p>Network connection issues detected. Some videos may not load correctly.</p>
					<button onClick={() => fetchSharedVideos(pagination.currentPage)}>Try Again</button>
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
					
					{/* Server-side pagination controls */}
					{pagination.totalPages > 1 && (
						<div className="pagination">
							<button 
								onClick={() => handlePageChange(pagination.currentPage - 1)} 
								disabled={!pagination.hasPreviousPage}
							>
								Previous
							</button>
							<span>
								Page {pagination.currentPage} of {pagination.totalPages}
							</span>
							<button 
								onClick={() => handlePageChange(pagination.currentPage + 1)} 
								disabled={!pagination.hasNextPage}
							>
								Next
							</button>
						</div>
					)}
					
					<div className="pagination-info">
						Showing {filteredVideos.length} of {pagination.totalCount} videos
					</div>
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