import React from 'react';
import VideoContainer from './VideoContainer';

const VideoGrid = ({ videos, onDelete, renderUsername = false, renderInfo = false }) => {
	// Track video ID that is currently active
	const [activeVideoID, setActiveVideoID] = React.useState(null);
	
	return (
		// Main container for video grid
		<div className="video-grid">
			{videos.map((video) => (
				<VideoContainer 
					key={video.id} // Unique key for each video
					id={video.id} // Unique ID for each video
					title={video.title} // Title of the video
					videoUrl={video.videoUrl} // URL for the video
					username={video.username} // Username of uploader
					isActive={activeVideoID === video.id} // Check if video is active
					onActivate={() => setActiveVideoID(video.id)} // Function to activate video
					onDelete={onDelete} // Function to delete video
					isOwnVideo={video.isOwnVideo} // Whether this is the current user's video
					isSharedVideo={video.isSharedVideo} // Whether this is a shared video
					metadata={video.metadata} // Video metadata for info display
					showMetadata={video.showMetadata} // Whether to show metadata
					toggleMetadata={video.toggleMetadata} // Function to toggle metadata display
					renderUsername={renderUsername} // Whether to render username
					renderInfo={renderInfo} // Whether to render info button
				/>
			))}
		</div>
	);
};

export default React.memo(VideoGrid);