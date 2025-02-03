import React from 'react';
import VideoContainer from './VideoContainer';

const VideoGrid = ({ videos }) => {
    if (!videos || videos.length === 0) {
        return <p>No videos available.</p>;
    }
    return (
        <div className="video-grid">
            {videos.map((video) => (
                <VideoContainer key={video.id} video={video} />
        ))}
    </div>
    );
};

export default VideoGrid;
