import React, { useEffect, useState } from 'react';
import { secureStorage } from '../utils/secureStorage'; // or wherever it's defined

const SharedPage = () => {
  const [videos, setVideos] = useState([]);
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

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const token = await secureStorage.getToken(); // Fetch token securely from Electron
  
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

            <div className="video-actions">
              <button onClick={() => toggleInfo(video.id)}>Info</button>
              <button onClick={() => handleDelete(video.id)} disabled={deletingId === video.id}>
                {deletingId === video.id ? "Deleting..." : "Delete"}
              </button>
            </div>

            {infoVideoId === video.id && (
              <div className="video-info">
                <p><strong>Username:</strong> {video.username}</p>
                <p><strong>Filename:</strong> {video.filename}</p>
                <p><strong>Resolution:</strong> {video.resolution}</p>
                <p><strong>Duration:</strong> {video.duration} sec</p>
                <p><strong>Size:</strong> {(video.size / 1024 / 1024).toFixed(2)} MB</p>
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
