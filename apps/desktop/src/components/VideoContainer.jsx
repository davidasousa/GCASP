import React from 'react';
import VideoPlayer from './VideoPlayer';

const VideoContainer = ({ video }) => {
	return (
		<div className="video-container">
			<div className="video-display">
				<VideoPlayer
					videoUrl={video.videoUrl}
					onReady={(player) => console.log('Player ready!', player)}
				/>
			</div>
			<p className="video-title">{video.title}</p>
		</div>
	);
};

export default VideoContainer;
