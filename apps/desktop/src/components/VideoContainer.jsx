import React, { useState } from 'react';
import VideoPlayer from './VideoPlayer';

const VideoContainer = ({ id, title, videoUrl, isActive, onActivate }) => {
	const [hasError, setHasError] = useState(false);

	const handlePlayerReady = (player) => {
		player.on('error', () => {
			setHasError(true);
		});
	};

	return (
		<div className="video-container" onClick={onActivate}>
			<div className="video-display">
				<VideoPlayer
					videoUrl={videoUrl}
					isActive={isActive}
					onReady={handlePlayerReady}
					options={{ inactivityTimeout: 2000 }}
				/>
			</div>
			<h3 className="video-title mt-2">{title}</h3>
		</div>
	);
};

export default React.memo(
	VideoContainer,
	(prevProps, nextProps) =>
		prevProps.videoUrl === nextProps.videoUrl &&
		prevProps.isActive === nextProps.isActive
);
