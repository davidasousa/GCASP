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
		<div className="video-container" style={{ position: 'relative' }}>
			<div className="video-display">
				<VideoPlayer
					videoUrl={videoUrl}
					onReady={handlePlayerReady}
					options={{ inactivityTimeout: 2000 }}
				/>
			</div>
			<div
				className="video-header"
				style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}
			>
				<h3 className="video-title" style={{ margin: 0 }}>{title}</h3>
				<button
					onClick={handleDeleteClick}
					style={{
						background: 'red',
						color: 'white',
						border: 'none',
						padding: '5px 10px',
						borderRadius: '4px',
						cursor: 'pointer'
					}}
					aria-label={`Delete ${title}`}
				>
					Delete
				</button>
			</div>
			{showDeletePrompt && (
				<div
					className="delete-modal"
					style={{
						position: 'fixed',
						top: 0,
						left: 0,
						width: '100vw',
						height: '100vh',
						backgroundColor: 'rgba(0,0,0,0.5)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 1000
					}}
				>
					<div
						style={{
							background: '#fff',
							padding: '20px',
							borderRadius: '8px',
							textAlign: 'center',
							maxWidth: '300px'
						}}
					>
						<p>Are you sure you want to delete "{title}"?</p>
						<div
							style={{
								marginTop: '20px',
								display: 'flex',
								justifyContent: 'space-around'
							}}
						>
							<button onClick={cancelDelete} style={{ padding: '10px 20px' }}>
								Cancel
							</button>
							<button
								onClick={confirmDelete}
								style={{
									padding: '10px 20px',
									backgroundColor: 'red',
									color: 'white',
									border: 'none',
									borderRadius: '4px'
								}}
							>
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
