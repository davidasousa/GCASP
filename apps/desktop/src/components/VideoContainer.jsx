import React, { useState } from 'react';
import VideoPlayer from './VideoPlayer';

const VideoContainer = ({ id, title, videoUrl }) => {
    const [hasError, setHasError] = useState(false);

    const handlePlayerReady = (player) => {
		// Listen for player errors
        player.on('error', () => {
            setHasError(true);
        });
    };
    // Main container wrapper for video player
    return (
        <div className="video-container">
            <div className="video-display">
                <VideoPlayer
                    videoUrl={videoUrl}
                    onReady={handlePlayerReady}
                    options={{
                        inactivityTimeout: 2000 // Hide controls after 2 seconds of inactivity
                    }}
                />
            </div>
            <h3 className="video-title mt-2">{title}</h3>
        </div>
    );
};

export default React.memo(VideoContainer, (prevProps, nextProps) => {
    return prevProps.videoUrl === nextProps.videoUrl;
});