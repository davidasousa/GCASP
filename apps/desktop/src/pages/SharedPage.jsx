import React, { useState, useEffect, useMemo } from 'react';
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
	const [retryCount, setRetryCount] = useState(0);
	const [networkError, setNetworkError] = useState(false);
	
	// Client-side pagination for filtered view
	const [currentPage, setCurrentPage] = useState(1);
	const pageSize = 10; // Match server pagination size
	
	// Server-side pagination state (for "All Videos" or "My Videos")
	const [serverPagination, setServerPagination] = useState({
		currentPage: 1,
		totalPages: 1,
		totalCount: 0,
		pageSize: 10,
		hasNextPage: false,
		hasPreviousPage: false
	});

	// Critical effect: Reset page to 1 when category changes
	useEffect(() => {
		setCurrentPage(1);
	}, [activeCategory]);

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

	// Function to load shared OR my videos from the server with pagination
	const fetchVideos = async (page = 1) => {
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
			
			// Choose endpoint based on category
			let result;
			if (activeCategory === 'all') {
				result = await API.getSharedVideos(page, pageSize);
			} else {
				result = await API.getMyVideos(page, pageSize);
			}
			
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
			
			// Store the page of videos
			setVideos(processedVideos);
			setServerPagination(result.pagination);
			setRetryCount(0); // Reset retry counter on success
			
			setNotification({
				visible: true,
				message: 'Videos loaded successfully',
				type: 'success'
			});
		} catch (error) {
			console.error('Error loading videos:', error);
			window.electron?.log.error('Error loading videos', {
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
					fetchVideos(serverPagination.currentPage);
				}, 3000 * nextRetryCount); // 3s, 6s, etc.
			}
		} finally {
			setIsLoading(false);
		}
	};

	// Load videos after user data is loaded or category changes
	useEffect(() => {
		if (userDataLoaded) {
			fetchVideos(1);
		}
	}, [userDataLoaded, activeCategory]);

	// Filter videos based on category and handle pagination
	const { filteredVideos, paginationInfo } = useMemo(() => {
		// For service‐side filtering, just pass through
		return {
			filteredVideos: videos,
			paginationInfo: {
				...serverPagination,
				isClientSide: false
			}
		};
	}, [videos, serverPagination]);

	// Update videos whenever filteredVideos changes
	useEffect(() => {
		setVideos(filteredVideos);
	}, [filteredVideos]);

	// Handle category change
	const handleCategoryChange = (category) => {
		if (category === activeCategory) return;
		
		// reset to page 1 on any category switch
		setCurrentPage(1);
		setServerPagination(prev => ({
			...prev,
			currentPage: 1
		}));
		setActiveCategory(category);
	};

	// Handle page change
	const handlePageChange = (newPage) => {
		if (newPage === paginationInfo.currentPage) return;
		
		// change page on the active category
		fetchVideos(newPage);
		setServerPagination(prev => ({
			...prev,
			currentPage: newPage
		}));
		// Scroll to top
		window.scrollTo(0, 0);
	};

	// Handle delete action
	const handleDeleteVideo = async (id) => {
		try {
			const token = await secureStorage.getToken();
			await API.deleteVideo(id, token);
			
			// Remove from current page
			setVideos(prev => prev.filter(video => video.id !== id));
			
			// Update server pagination count
			setServerPagination(prev => ({
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
			const refreshedVideo = await API.refreshVideoUrl(videoId);
			
			// Update the video in the list with the fresh URL
			setVideos(prev => 
				prev.map(v => 
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
	const gridVideos = videos.map(video => {
		return {
			id: video.id,
			title: video.title,
			videoUrl: video.videoUrl,
			cloudFrontUrl: video.cloudFrontUrl,
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

	// Debug helper to show current state
	console.log(`Category: ${activeCategory}, Page: ${currentPage}, Videos: ${videos.length}`);

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
					onClick={() => {
						setCurrentPage(1);
						fetchVideos(1);
					}}
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
				</div>
			)}
			
			{isLoading ? (
				<div className="loading-container">
					<div className="loading-spinner"></div>
					<p>Loading videos...</p>
				</div>
			) : videos.length > 0 ? (
				<div>
					<VideoGrid 
						videos={gridVideos} 
						onDelete={handleDeleteVideo}
						renderUsername={true}
						renderInfo={true}
					/>
					
					{/* Pagination controls */}
					{paginationInfo.totalPages > 1 && (
						<div className="pagination">
							<button 
								onClick={() => handlePageChange(paginationInfo.currentPage - 1)} 
								disabled={!paginationInfo.hasPreviousPage}
							>
								Previous
							</button>
							<span>
								Page {paginationInfo.currentPage} of {paginationInfo.totalPages}
							</span>
							<button 
								onClick={() => handlePageChange(paginationInfo.currentPage + 1)} 
								disabled={!paginationInfo.hasNextPage}
							>
								Next
							</button>
						</div>
					)}
					
					<div className="pagination-info">
						{activeCategory === 'all'
							? `Showing ${videos.length} of ${paginationInfo.totalCount} videos`
							: `Showing ${videos.length} of ${paginationInfo.totalCount} of your videos`
						}
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
