import React, { useEffect, useState } from 'react';
import { secureStorage } from '../utils/secureStorage';
import API from '../services/api_index';

const SharedPage = () => {
	const [videos, setVideos] = useState([]);
	const [notification, setNotification] = useState({ visible: false, message: '', type: 'success' });
	const [infoVideoId, setInfoVideoId] = useState(null);
	const [deletingId, setDeletingId] = useState(null);

	const fetchSharedVideos = async () => {
		try {
		const videos = await API.getSharedVideos();
		setVideos(videos);
		} catch (err) {
		setNotification({ visible: true, message: err.message || 'Failed to load shared videos', type: 'error' });
		}
	};

	const handleDelete = async (id) => {
		setDeletingId(id);
		try {
		const token = await secureStorage.getToken();
		await API.deleteVideo(id, token);

		setVideos(prev => prev.filter(video => video.id !== id));
		setNotification({ visible: true, message: 'Video deleted successfully', type: 'success' });
		} catch (err) {
		setNotification({ visible: true, message: err.message || 'Delete failed', type: 'error' });
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