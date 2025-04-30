import React, { useRef, useEffect, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

const VideoPlayer = ({ videoUrl, isActive, options = {}, onReady }) => {
	const videoRef = useRef(null);
	const playerRef = useRef(null);
	const [hasError, setHasError] = useState(false);

	// Create player only once on mount
	useEffect(() => {
		if (!playerRef.current) {
			const videoElement = videoRef.current;
			if (!videoElement) return;

			// Default configuration options for video.js
			const defaultOptions = {
				controls: true,
				autoplay: false,
				preload: 'metadata',
				fluid: true,
				playbackRates: [0.5, 1, 1.5, 2],
				responsive: true,
				
				// Improve performance and reliability
				html5: {
					vhs: {
						overrideNative: true,
						limitRenditionByPlayerDimensions: false,
						smoothQualityChange: true,
						handleManifestRedirects: true,
					},
					nativeAudioTracks: false,
					nativeVideoTracks: false
				},
				
				// Improve seeking behavior
				liveui: false,
				liveTracker: false,
				inactivityTimeout: 2000,
				
				// Error handling improvements
				techOrder: ['html5'],
				enableSourceset: true,

				// Control bar configuration
				controlBar: {
					timeControls: true,
					children: [
						'playToggle',
						'volumePanel',
						'currentTimeDisplay',
						'timeDivider',
						'durationDisplay',
						'progressControl',
						'playbackRateMenuButton',
						'fullscreenToggle'
					]
				},

				// User interaction settings
				userActions: {
					hotkeys: true
				},

				loadingSpinner: true,
				errorDisplay: true,
				bigPlayButton: true,
				sources: [{
					src: videoUrl,
					type: detectVideoType(videoUrl)
				}]
			};

			// Create new player
			const player = videojs(
				videoElement,
				{ ...defaultOptions, ...options },
				function onPlayerReady() {
					// Setup keyboard shortcuts
					player.on('keydown', handleKeypress);
					
					// Handle errors
					player.on('error', handlePlayerError);
					
					// Monitor seeking behavior
					player.on('seeking', () => {
						console.log('Seeking to:', player.currentTime());
					});
					
					player.on('seeked', () => {
						console.log('Seeked to:', player.currentTime());
					});

					if (onReady) {
						onReady(player);
					}
				}
			);

			playerRef.current = player;
		}

		// Cleanup function
		return () => {
			if (playerRef.current) {
				playerRef.current.dispose();
				playerRef.current = null;
			}
		};
	}, []);

	// Update video source when videoUrl changes
	useEffect(() => {
		if (playerRef.current && videoUrl) {
			setHasError(false);
			
			// Detect video type (mp4, webm, etc.)
			const videoType = detectVideoType(videoUrl);
			
			// Add cache-busting parameter for CloudFront
			const cacheBustUrl = addCacheBustingParam(videoUrl);
			
			playerRef.current.src({
				src: cacheBustUrl,
				type: videoType
			});
		}
	}, [videoUrl]);

	// Handle play/pause based on isActive
	useEffect(() => {
		if (playerRef.current) {
			if (isActive && !hasError) {
				playerRef.current.play().catch((error) => {
					console.error('Error playing video:', error);
				});
			} else {
				playerRef.current.pause();
			}
		}
	}, [isActive, hasError]);

	// Helper function to detect video type from URL
	const detectVideoType = (url) => {
		if (!url) return 'video/mp4'; // Default
		
		const extension = url.split('.').pop().toLowerCase();
		const typeMap = {
			'mp4': 'video/mp4',
			'webm': 'video/webm',
			'mov': 'video/quicktime',
			'avi': 'video/x-msvideo',
			'mkv': 'video/x-matroska'
		};
		
		// For CloudFront URLs which may not have file extension
		if (url.includes('cloudfront.net')) {
			return 'video/mp4'; // Assume MP4 for CloudFront
		}
		
		return typeMap[extension] || 'video/mp4';
	};
	
	// Add cache-busting parameter to URL
	const addCacheBustingParam = (url) => {
		if (!url) return '';
		
		// Only add for CloudFront/S3 URLs to prevent issues with signed URLs
		if (url.includes('cloudfront.net') || url.includes('amazonaws.com')) {
			const separator = url.includes('?') ? '&' : '?';
			return `${url}${separator}_cb=${Date.now()}`;
		}
		
		return url;
	};
	
	// Handle video player keypress events
	const handleKeypress = (e) => {
		// Space bar - toggle play/pause
		if (e.code === 'Space') {
			if (playerRef.current.paused()) {
				playerRef.current.play();
			} else {
				playerRef.current.pause();
			}
		}
		// Arrow key controls
		if (e.code === 'ArrowLeft') {
			playerRef.current.currentTime(playerRef.current.currentTime() - 5);
		}
		if (e.code === 'ArrowRight') {
			playerRef.current.currentTime(playerRef.current.currentTime() + 5);
		}
		if (e.code === 'ArrowUp') {
			playerRef.current.volume(Math.min(playerRef.current.volume() + 0.1, 1));
		}
		if (e.code === 'ArrowDown') {
			playerRef.current.volume(Math.max(playerRef.current.volume() - 0.1, 0));
		}
	};
	
	// Handle player errors
	const handlePlayerError = (e) => {
		setHasError(true);
		const error = playerRef.current.error();
		console.error('Video.js error:', error);
		
		// CloudFront specific error handling
		if (error && error.message) {
			// Handle expired token or 403 errors (common with CloudFront)
			if (error.message.includes('403') || 
				error.message.includes('Forbidden') ||
				error.message.includes('Access Denied')) {
				
				console.log('CloudFront token likely expired, requesting fresh URL');
				
				// Notify parent component to refresh the video URL
				if (onVideoError) {
					onVideoError();
				}
			}
			
			// Handle range errors (also common with CloudFront)
			if (error.code === 4 || 
				(error.message.includes('416') || 
				error.message.includes('range') || 
				error.message.includes('satisfiable'))) {
				
				console.log('Handling range error, attempting to reload video');
				
				// Try to recover by reloading with the current time
				const currentTime = playerRef.current.currentTime();
				const cacheBustUrl = `${videoUrl}?reload=${Date.now()}`;
				
				playerRef.current.src({
					src: cacheBustUrl,
					type: detectVideoType(videoUrl)
				});
				
				playerRef.current.load();
				playerRef.current.on('loadedmetadata', () => {
					playerRef.current.currentTime(currentTime);
					setHasError(false);
				});
			}
		}
	};

	// Render video element with video.js wrapper
	return (
		<div data-vjs-player className="video-player-container">
			<video 
				ref={videoRef}
				className="video-js vjs-big-play-centered vjs-fluid"
			/>
			{hasError && (
				<div className="video-error-message">
					Unable to load video. Please try again later.
				</div>
			)}
		</div>
	);
};

export default React.memo(VideoPlayer);