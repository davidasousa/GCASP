import React from 'react';
import VideoContainer from './VideoContainer';

const VideoGrid = ({ videos }) => {
    return (
        // Main container for video grid
        <div className="video-grid">
            {videos.map((video) => (
                <VideoContainer 
                    key={video.id} // Unique key for each video
                    id={video.id} // Unique ID for each video
                    title={video.title} // Title of the video
                    videoUrl={video.videoUrl} // URL for the video
                />
            ))}
        </div>
    );
};

export default React.memo(VideoGrid);