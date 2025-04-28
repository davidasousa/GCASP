import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import VideoPlayer from './VideoPlayer';
import { secureStorage } from '../utils/secureStorage';

const VideoContainer = ({ id, title, videoUrl, isActive, onActivate, onDelete }) => {
	const [hasError, setHasError] = useState(false);
	const [showDeletePrompt, setShowDeletePrompt] = useState(false);
	const [showUploadConfirm, setShowUploadConfirm] = useState(false);
	const navigate = useNavigate();

	const handlePlayerReady = (player) => {
		player.on('error', () => {
			setHasError(true);
		});
	};

	const handleEditClick = () => {
		console.log(`Editing video: ${title}`);
		// Navigate to edit page with video id
		navigate(`/edit/${encodeURIComponent(title)}`);
	};

	const handleDeleteClick = () => {
		setShowDeletePrompt(true);
	};

	const confirmDelete = async () => {
		try {
			const response = await window.electron.removeSpecificVideo(title);
			if (response.success && onDelete) {
				onDelete(id);
			}
		} catch (error) {
			console.error('Error deleting video:', error);
		}
		setShowDeletePrompt(false);
	};

	const cancelDelete = () => {
		setShowDeletePrompt(false);
	};

	// Upload
	const handleUpload = () => { setShowUploadConfirm(true); }
	const cancelUpload = () => { setShowUploadConfirm(false); }

	// Upload Functions
	const handleUploadSubmit = async () => {
		setShowUploadConfirm(false);
		const token = await secureStorage.getToken();
		const response = await window.electron.triggerUploadClip(title, token);
	}

	return (
		<div className="video-container">
			<div className="video-display" onClick={onActivate}>
				<VideoPlayer
					videoUrl={videoUrl}
					isActive={isActive}
					onReady={handlePlayerReady}
					options={{ inactivityTimeout: 2000 }}
				/>
			</div>
			<div className="video-header">
				<h3 className="video-title">{title}</h3>
				<div className="video-actions">
					<button
						onClick={handleUpload}
						className="upload-button"
						aria-label={`Upload ${title}`}
					>
						Upload
					</button>
					<button
						onClick={handleEditClick}
						className="edit-button"
						aria-label={`Edit ${title}`}
					>
						Edit
					</button>
					<button
						onClick={handleDeleteClick}
						className="delete-button"
						aria-label={`Delete ${title}`}
					>
						Delete
					</button>
				</div>
			</div>
			{showDeletePrompt && (
				<div className="delete-modal">
					<div className="modal-content">
						<p>Are you sure you want to delete "{title}"?</p>
						<div className="modal-buttons">
							<button onClick={cancelDelete} className="cancel-button">
								Cancel
							</button>
							<button onClick={confirmDelete} className="delete-button">
								Delete
							</button>
						</div>
					</div>
				</div>
			)}
			{/* Upload Confirmation Modal */}
			{showUploadConfirm && (
				<div className="upload-modal">
					<div className="modal-content">
						<p>Are you sure you want to upload?</p>
						<div className="modal-buttons">
							<button onClick={cancelUpload} className="cancel-upload-button">
								Cancel
							</button>
							<button onClick={handleUploadSubmit} className="upload-button">
								Upload
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default React.memo(
	VideoContainer,
	(prevProps, nextProps) =>
		prevProps.videoUrl === nextProps.videoUrl &&
		prevProps.isActive === nextProps.isActive
);