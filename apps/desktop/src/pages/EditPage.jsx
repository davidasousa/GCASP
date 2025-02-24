import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';

const EditPage = () => {
    const { videoId } = useParams();
    const navigate = useNavigate();
    const [videoData, setVideoData] = useState(null);
    const [title, setTitle] = useState('');
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [compressSize, setCompressSize] = useState(20); // Default 20MB
    const [metadata, setMetadata] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const playerRef = useRef(null);

    // Load video data
    useEffect(() => {
        const fetchVideoData = async () => {
            try {
                // Get video details
                const localVideos = await window.electron.getLocalVideos();
                const video = localVideos.find(v => v.id === videoId || v.filename === videoId);
                
                if (!video) {
                    setError('Video not found');
                    return;
                }

                const videoUrl = `gcasp://${video.id.replace('clip_', '')}/`;
                setVideoData({
                    id: video.id,
                    title: video.filename,
                    videoUrl
                });
                setTitle(video.filename);

                // Get video metadata
                const meta = await window.electron.getVideoMetadata(video.filename);
                setMetadata(meta);
                setDuration(meta.duration || 0);
                setEndTime(meta.duration || 0);
            } catch (err) {
                setError('Failed to load video: ' + err.message);
                console.error('Error loading video:', err);
            }
        };

        fetchVideoData();
    }, [videoId]);

    // Handle player ready event to get player reference
    const handlePlayerReady = (player) => {
        playerRef.current = player;
        
        // Listen for time updates to show current position
        player.on('timeupdate', () => {
            const currentTime = player.currentTime();
            document.getElementById('current-time').textContent = formatTime(currentTime);
        });
    };

    // Format time in seconds to MM:SS.ms format
    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    // Set current position as start time
    const setCurrentAsStart = () => {
        if (playerRef.current) {
            const time = playerRef.current.currentTime();
            setStartTime(time);
        }
    };

    // Set current position as end time
    const setCurrentAsEnd = () => {
        if (playerRef.current) {
            const time = playerRef.current.currentTime();
            setEndTime(time);
        }
    };

    // Preview the trimmed section
    const previewTrim = () => {
        if (playerRef.current) {
            playerRef.current.currentTime(startTime);
            playerRef.current.play();
            
            // Stop playback when end time is reached
            const checkTime = () => {
                if (playerRef.current.currentTime() >= endTime) {
                    playerRef.current.pause();
                    playerRef.current.removeEventListener('timeupdate', checkTime);
                }
            };
            
            playerRef.current.on('timeupdate', checkTime);
        }
    };

    // Save the edited video
    const saveChanges = async () => {
        try {
            setLoading(true);
            setError(null);
            
            // Basic validation
            if (startTime >= endTime) {
                setError('Start time must be before end time');
                setLoading(false);
                return;
            }
            
            if (!title.trim()) {
                setError('Title cannot be empty');
                setLoading(false);
                return;
            }
            
            // Prepare save parameters
            const params = {
                originalFilename: videoData.title,
                newTitle: title,
                startTime,
                endTime,
                compressSizeMB: compressSize
            };
            
            // Save changes using IPC
            const result = await window.electron.saveEditedVideo(params);
            
            if (result.success) {
                // Navigate back to home page
                navigate('/');
            } else {
                setError(result.error || 'Failed to save edited video');
            }
        } catch (err) {
            setError('Error saving video: ' + err.message);
            console.error('Error saving video:', err);
        } finally {
            setLoading(false);
        }
    };

    // Cancel editing and return to home
    const cancelEdit = () => {
        navigate('/');
    };

    // If still loading or error
    if (!videoData) {
        return (
            <div className="edit-page">
                {error ? (
                    <div className="error-message">{error}</div>
                ) : (
                    <div className="loading">Loading video...</div>
                )}
            </div>
        );
    }

    return (
        <div className="edit-page">
            <h2>Edit Video</h2>
            
            <div className="edit-container">
                {/* Video Preview */}
                <div className="video-preview">
                    <VideoPlayer 
                        videoUrl={videoData.videoUrl} 
                        isActive={false}
                        onReady={handlePlayerReady}
                        options={{
                            fluid: true,
                            aspectRatio: '16:9',
                            autoplay: false,
                            bigPlayButton: true,
                            controlBar: {
                                playToggle: true,
                                volumePanel: true,
                                currentTimeDisplay: true,
                                timeDivider: true,
                                durationDisplay: true,
                                progressControl: true,
                                fullscreenToggle: true
                            }
                        }}
                    />
                </div>
                
                {/* Edit Controls */}
                <div className="edit-controls">
                    {/* Title Edit */}
                    <div className="control-group">
                        <label htmlFor="title-input">Title:</label>
                        <input 
                            id="title-input"
                            type="text" 
                            value={title} 
                            onChange={(e) => setTitle(e.target.value)} 
                            className="title-input"
                        />
                    </div>
                    
                    {/* Time Controls */}
                    <div className="control-group">
                        <h3>Trim Video</h3>
                        <div className="time-display">
                            <span>Current Position: </span>
                            <span id="current-time">00:00.00</span>
                        </div>
                        
                        <div className="trim-controls">
                            <div className="time-input">
                                <label htmlFor="start-time">Start Time:</label>
                                <input 
                                    id="start-time"
                                    type="text" 
                                    value={formatTime(startTime)} 
                                    readOnly 
                                />
                                <button onClick={setCurrentAsStart}>Set Current</button>
                            </div>
                            
                            <div className="time-input">
                                <label htmlFor="end-time">End Time:</label>
                                <input 
                                    id="end-time"
                                    type="text" 
                                    value={formatTime(endTime)} 
                                    readOnly 
                                />
                                <button onClick={setCurrentAsEnd}>Set Current</button>
                            </div>
                            
                            <button onClick={previewTrim} className="preview-button">
                                Preview Trim
                            </button>
                        </div>
                    </div>
                    
                    {/* Compression Controls */}
                    <div className="control-group">
                        <h3>Compression</h3>
                        <div className="compression-control">
                            <label htmlFor="compress-size">Target Size (MB):</label>
                            <input 
                                id="compress-size"
                                type="number" 
                                min="1" 
                                max="100" 
                                value={compressSize}
                                onChange={(e) => setCompressSize(Math.max(1, parseInt(e.target.value) || 1))}
                            />
                        </div>
                    </div>
                    
                    {/* Metadata Display */}
                    <div className="control-group">
                        <h3>Video Metadata</h3>
                        <div className="metadata">
                            <p><strong>Duration:</strong> {formatTime(duration)}</p>
                            <p><strong>Resolution:</strong> {metadata.width || '?'} x {metadata.height || '?'}</p>
                            <p><strong>Format:</strong> {metadata.format || 'Unknown'}</p>
                            <p><strong>Size:</strong> {metadata.size ? `${(metadata.size / (1024 * 1024)).toFixed(2)} MB` : 'Unknown'}</p>
                        </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="action-buttons">
                        <button 
                            onClick={cancelEdit}
                            className="cancel-button"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={saveChanges}
                            className="save-button"
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                    
                    {/* Error Message */}
                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EditPage;