import React, { useState } from 'react';
import VideoPlayer from './VideoPlayer';

const VideoContainer = ({ id, title, videoUrl, isActive, onActivate, onDelete }) => {
	const [hasError, setHasError] = useState(false);
	const [showDeletePrompt, setShowDeletePrompt] = useState(false);


	const handlePlayerReady = (player) => {
		player.on('error', () => {
			setHasError(true);
		});
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

	return (
		<div className="video-container">
			<div className="video-display">
				<VideoPlayer
					videoUrl={videoUrl}
					onReady={handlePlayerReady}
					options={{ inactivityTimeout: 2000 }}
				/>
			</div>
			<div className="video-header">
				<h3 className="video-title">{title}</h3>
				<button
					onClick={handleDeleteClick}
					className="delete-button"
					aria-label={`Delete ${title}`}
				>
					Delete
				</button>
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
		</div>
	);
};

export default React.memo(
	VideoContainer,
	(prevProps, nextProps) =>
		prevProps.videoUrl === nextProps.videoUrl &&
		prevProps.isActive === nextProps.isActive
);
