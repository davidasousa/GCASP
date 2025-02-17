import React, { useRef, useEffect } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

const VideoPlayer = ({ videoUrl, options = {}, onReady }) => {
    const videoRef = useRef(null);
    const playerRef = useRef(null);

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
                    ],
                },

				// User interaction settings
                userActions: {
                    hotkeys: true // Enable keyboard shortcuts
                },

				// Keyboard shortcuts
                keyboard: {
                    focused: true,
                    global: false
                },

				// HTML5 video settings
                html5: {
                    vhs: {
                        overrideNative: true // Use video.js HLS implementation
                    },
                    nativeAudioTracks: false, // Don't use native audio track controls
                    nativeVideoTracks: false // Don't use native video track controls
                },
                loadingSpinner: true, // Show loading animation
                errorDisplay: true, // Show error messages
                bigPlayButton: true, // Show large play button in center
                textTrackSettings: false, // Hide closed caption settings
                // Video source config
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

                    if (onReady) {
                        onReady(player);
                    }
                }
            );

            playerRef.current = player;
        } else {
			// If player exists, just update the video source
            playerRef.current.src({ 
                src: videoUrl, 
                type: 'video/mp4' 
            });
        }

		// Cleanup function
        return () => {
            if (playerRef.current) {
                playerRef.current.dispose();
                playerRef.current = null;
            }
        };
    }, [videoUrl, options, onReady]);

	// Render video element with video.js wrapper
    return (
        <div data-vjs-player>
            <video 
                ref={videoRef}
                className="video-js vjs-big-play-centered"
            />
        </div>
    );
};

export default React.memo(VideoPlayer);