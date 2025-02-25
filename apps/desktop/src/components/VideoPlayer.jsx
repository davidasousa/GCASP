import React, { useRef, useEffect } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

const VideoPlayer = ({ videoUrl, isActive, options = {}, onReady }) => {
	const videoRef = useRef(null);
	const playerRef = useRef(null);

	// Create a new player only once on mount.
	useEffect(() => {
		// Create a new player if it doesn't exist
		if (!playerRef.current) {
			const videoElement = videoRef.current;
			if (!videoElement) return;

			// Default configuration options for video.js
			const defaultOptions = {
				// Basic player settings
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
					timeControls: true, // Enable time control display
					children: [
						'playToggle', // Play/Pause button
						'volumePanel', // Volume control
						'currentTimeDisplay', // Display current video time
						'timeDivider', // Divider between current and total time
						'durationDisplay', // Total video time
						'progressControl', // Progress bar
						'playbackRateMenuButton', // Speed control
						'fullscreenToggle' // Fullscreen button
					]
				},

				// User interaction settings
				userActions: {
					hotkeys: true // Enable keyboard shortcuts
				},

				loadingSpinner: true, // Show loading animation
				errorDisplay: true, // Show error messages
				bigPlayButton: true, // Show large play button in center
				sources: [{
					src: videoUrl, // URL of the video
					type: 'video/mp4' // Video format
				}]
			};

			// Create new video.js player instance
			const player = videojs(
				videoElement,
				{ ...defaultOptions, ...options }, // Merge default and custom options
				function onPlayerReady() {
					// Setup keyboard shortcuts
					player.on('keydown', (e) => {
						// Space bar - toggle play/pause
						if (e.code === 'Space') {
							if (player.paused()) {
								player.play();
							} else {
								player.pause();
							}
						}
						// Left arrow - Rewind 5 seconds
						if (e.code === 'ArrowLeft') {
							player.currentTime(player.currentTime() - 5);
						}
						// Right arrow - Fast forward 5 seconds
						if (e.code === 'ArrowRight') {
							player.currentTime(player.currentTime() + 5);
						}
						// Up arrow - Increase volume by 10%
						if (e.code === 'ArrowUp') {
							player.volume(Math.min(player.volume() + 0.1, 1));
						}
						// Down arrow - Decrease volume by 10%
						if (e.code === 'ArrowDown') {
							player.volume(Math.max(player.volume() - 0.1, 0));
						}
					});

					// Improve error handling for seeking
					player.on('error', function(e) {
						const error = player.error();
						console.error('Video.js error:', error);
						
						// Handle range not satisfiable errors specifically
						if (error.code === 4 && (error.message.includes('416') || 
							error.message.includes('range') || 
							error.message.includes('satisfiable'))) {
							console.log('Handling range error, attempting to reload video');
							
							// Try to recover by reloading with the current time
							const currentTime = player.currentTime();
							
							player.src({
								src: `${videoUrl}?reload=${Date.now()}`,
								type: 'video/mp4'
							});
							
							player.load();
							player.on('loadedmetadata', () => {
								player.currentTime(currentTime);
							});
						}
					});
					
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

		// Cleanup function when component unmounts
		return () => {
			if (playerRef.current) {
				playerRef.current.dispose();
				playerRef.current = null;
			}
		};
	}, []); // Run only once on mount

	// Update the video source when videoUrl changes.
	useEffect(() => {
		if (playerRef.current) {
			playerRef.current.src({ 
				src: videoUrl, 
				type: 'video/mp4' 
			});
			
			// Add timestamp query parameter to bust cache
			playerRef.current.src({
				src: `${videoUrl}?t=${Date.now()}`,
				type: 'video/mp4'
			});
		}
	}, [videoUrl]);

	// Play or pause based on isActive.
	useEffect(() => {
		if (playerRef.current) {
			if (isActive) {
				playerRef.current.play().catch((error) => {
					console.error('Error playing video:', error);
				});
			} else {
				playerRef.current.pause();
			}
		}
	}, [isActive]);

	// Render video element with video.js wrapper
	return (
		<div data-vjs-player className="video-player-container">
			<video 
				ref={videoRef}
				className="video-js vjs-big-play-centered vjs-fluid"
			/>
		</div>
	);
};

export default React.memo(VideoPlayer);