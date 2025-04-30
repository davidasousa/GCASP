import React, { useEffect, useState } from 'react';
import '../styles/SharedPage.css'; // Import CSS if not already
const SharedPage = () => {
  const [videos, setVideos] = useState([]);
  const [currentUser, setCurrentUser] = useState(null); // store current logged-in username
  const [notification, setNotification] = useState({ visible: false, message: '', type: 'success' });
  const [infoVideoId, setInfoVideoId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchSharedVideos = async () => {
    try {
      const res = await fetch("http://localhost:5001/api/shared-videos");
      const data = await res.json();
      const processed = data.videos.map(video => ({
        ...video,
        videoUrl: `http://localhost:5001/videos/stream/${video.filename}`,
      }));
      setVideos(processed);
    } catch (err) {
      console.error('Error loading shared videos:', err);
      setNotification({ visible: true, message: 'Failed to load shared videos', type: 'error' });
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const token = await window.secureStorage.getToken();
      const res = await fetch("http://localhost:5001/profile", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      setCurrentUser(data.username);
    } catch (err) {
      console.error("Error fetching current user:", err);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const token = await window.secureStorage.getToken();
      const res = await fetch(`http://localhost:5001/videos/${id}`, {
        method: "DELETE",
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setVideos(prev => prev.filter(video => video.id !== id));
        setNotification({ visible: true, message: 'Video deleted successfully', type: 'success' });
      } else {
        const data = await res.json();
        throw new Error(data.message || 'Delete failed');
      }
    } catch (err) {
      console.error("Delete error:", err);
      setNotification({ visible: true, message: err.message, type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  const toggleInfo = (id) => {
    setInfoVideoId(infoVideoId === id ? null : id);
  };

  useEffect(() => {
    fetchSharedVideos();
    fetchCurrentUser(); // load current logged in user

    if (notification.visible) {
      const timer = setTimeout(() => {
        setNotification({ ...notification, visible: false });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification.visible]);

  return (
    <div className="home-page">
      <div className="page-header">
        <h1>Shared Clips</h1>
      </div>

      <div className="button-group">
        <button className="refresh-button" onClick={fetchSharedVideos}>
          Refresh Shared Videos
        </button>
      </div>

      {notification.visible && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      {videos.length > 0 ? (
        videos.map(video => (
          <div key={video.id} className="video-card">
            <video src={video.videoUrl} controls width="100%" />

            <h3>{video.title}</h3>
            
            {/* Always show uploader */}
            <p><strong>Uploader:</strong> {video.username}</p>

            {/* Action Buttons */}
            <div className="video-actions">
              <button
                className="info-button"
                onClick={() => toggleInfo(video.id)}
              >
                {infoVideoId === video.id ? "Hide Info" : "Show Info"}
              </button>

              {/* Only show delete if uploader === current logged in user */}
              {currentUser === video.username && (
                <button
                  className="delete-button"
                  onClick={() => handleDelete(video.id)}
                  disabled={deletingId === video.id}
                >
                  {deletingId === video.id ? "Deleting..." : "Delete"}
                </button>
              )}
            </div>

            {/* Detailed Info Section */}
            {infoVideoId === video.id && (
              <div className="video-info">
                <p><strong>Filename:</strong> {video.filename}</p>
                <p><strong>Resolution:</strong> {video.resolution}</p>
                <p><strong>Duration:</strong> {video.duration} sec</p>
                <p><strong>Size:</strong> {(video.size / 1024 / 1024).toFixed(2)} MB</p>
                <p><strong>Status:</strong> {video.status}</p>
                <p><strong>Processing Status:</strong> {video.processingStatus}</p>
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="no-videos-message">
          <p>No Shared Videos Available</p>
        </div>
      )}
    </div>
  );
};

export default SharedPage;