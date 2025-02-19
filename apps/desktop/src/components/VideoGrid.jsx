import React from 'react';
import VideoContainer from './VideoContainer';

const VideoGrid = ({ videos }) => {
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
                    isActive={activeVideoID === video.id} // Check if video is active
                    onActivate={() => setActiveVideoID(video.id)} // Function to activate video
                />
            ))}
        </div>
    );
};

export default React.memo(VideoGrid);