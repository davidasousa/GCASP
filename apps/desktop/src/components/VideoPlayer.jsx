import React, { useRef, useEffect } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

const VideoPlayer = ({ videoUrl, options = {}, onReady }) => {
	const videoRef = useRef(null);
	const playerRef = useRef(null);

	useEffect(() => {
		if (!playerRef.current) {
			const videoElement = videoRef.current;
			if (!videoElement) return;

			const defaultOptions = {
				controls: true,
				autoplay: false,
				preload: 'auto',
				fluid: true,
				sources: [{ src: videoUrl, type: 'video/mp4' }],
			};

			playerRef.current = videojs(
				videoElement,
				{ ...defaultOptions, ...options },
				function onPlayerReady() {
					if (onReady) {
						onReady(playerRef.current);
					}
				}
			);
		} else {
			playerRef.current.src({ src: videoUrl, type: 'video/mp4' });
		}

		return () => {
			if (playerRef.current) {
				playerRef.current.dispose();
				playerRef.current = null;
			}
		};
	}, [videoUrl, options, onReady]);

	return (
		<div data-vjs-player>
			<video ref={videoRef} className="video-js vjs-big-play-centered" />
		</div>
	);
};

export default VideoPlayer;
