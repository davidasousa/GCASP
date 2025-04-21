import React, { useEffect, useState } from 'react';
import axios from 'axios';

const SharedPage = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await axios.get("http://localhost:5001/videos/shared?sort=createdAt");
        setVideos(res.data.videos);
      } catch (err) {
        console.error("Error loading videos", err);
      } finally {
        setLoading(false);
      }
    };
    fetchVideos();
  }, []);

  const handleCopy = (url, id) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const timeAgo = (timestamp) => {
    if (!timestamp) return "unknown time";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "unknown time";

    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
  };

  return (
    <div>
      <h2>🎬 Shared Clips</h2>
      {loading ? (
        <p>Loading...</p>
      ) : videos.length === 0 ? (
        <p>No shared videos yet.</p>
      ) : (
        <ul>
          {videos.map(video => (
            <li key={video.id} style={{ marginBottom: "2rem" }}>
              <h4>{video.title}</h4>
              <p>
                Uploaded: {timeAgo(video.createdAt)}<br />
                Duration: {video.duration}s | Resolution: {video.resolution}
              </p>
              <video
                width="480"
                height="270"
                controls
                src={`http://localhost:5001/videos/stream/${video.filename}`}
              />
              <br />
              <button onClick={() => handleCopy(video.shareUrl, video.id)}>
                {copiedId === video.id ? "Copied!" : "Copy Link"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SharedPage;
