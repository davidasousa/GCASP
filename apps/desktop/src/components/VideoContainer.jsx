import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import VideoPlayer from './VideoPlayer';
import { secureStorage } from '../utils/secureStorage';

const VideoContainer = ({
	id,
	title,
	videoUrl,
	cloudFrontUrl,    // CloudFront URL for sharing
	username,
	isActive,
	onActivate,
	onDelete,
	isOwnVideo,
	isSharedVideo = false,
	metadata,
	showMetadata,
	toggleMetadata,
	renderUsername = false,
	renderInfo = false
}) => {
	const [hasError, setHasError] = useState(false);
	const [showDeletePrompt, setShowDeletePrompt] = useState(false);
	const [showUploadConfirm, setShowUploadConfirm] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [notification, setNotification] = useState({
		visible: false,
		message: '',
		type: 'success'
	});
	
	const navigate = useNavigate();

	const handlePlayerReady = (player) => {
		player.on('error', () => {
			setHasError(true);
		});
	};

	const handleEditClick = () => {
		navigate(`/edit/${encodeURIComponent(title)}`);
	};

	const handleDeleteClick = () => {
		setShowDeletePrompt(true);
	};

	const confirmDelete = async () => {
		try {
			if (onDelete) {
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

	// Handle info button click
	const handleInfoClick = () => {
		if (toggleMetadata) {
			toggleMetadata();
		}
	};

	// Copy CloudFront URL to clipboard (only on shared videos)
	const handleCopyClick = () => {
		const link = cloudFrontUrl || videoUrl;
		navigator.clipboard.writeText(link)
			.then(() =>
				setNotification({
					visible: true,
					message: 'Link copied to clipboard!',
					type: 'success'
				})
			)
			.catch(() =>
				setNotification({
					visible: true,
					message: 'Failed to copy link.',
					type: 'error'
				})
			);
		setTimeout(() => setNotification(prev => ({ ...prev, visible: false })), 3000);
	};

	// Upload
	const handleUpload = () => { 
		setShowUploadConfirm(true); 
	};
	
	const cancelUpload = () => { 
		setShowUploadConfirm(false); 
	};

	// Upload Functions with progress and notification
	const handleUploadSubmit = async () => {
		try {
			setShowUploadConfirm(false);
			setUploading(true);
			setUploadProgress(0);
			
			const token = await secureStorage.getToken();
			
			// Setup progress event listener if available
			if (window.electron?.onUploadProgress) {
				window.electron.onUploadProgress((progress) => {
					setUploadProgress(progress);
				});
			}
			
			const uploadResult = await window.electron.triggerUploadClip(title, token);
			
			setUploading(false);
			setUploadProgress(0);
			
			if (uploadResult && uploadResult.success) {
				setNotification({
					visible: true,
					message: 'Video uploaded successfully!',
					type: 'success'
				});
				
				// Hide notification after 3 seconds
				setTimeout(() => setNotification(prev => ({ ...prev, visible: false })), 3000);
			} else {
				setNotification({
					visible: true,
					message: `Upload failed: ${uploadResult?.message || 'Unknown error'}`,
					type: 'error'
				});
				
				// Hide notification after 5 seconds
				setTimeout(() => setNotification(prev => ({ ...prev, visible: false })), 5000);
			}
		} catch (error) {
			console.error('Upload error:', error);
			setUploading(false);
			setUploadProgress(0);
			
			setNotification({
				visible: true,
				message: `Upload error: ${error.message || 'Unknown error'}`,
				type: 'error'
			});
			
			// Hide notification after 5 seconds
			setTimeout(() => setNotification(prev => ({ ...prev, visible: false })), 5000);
		}
	};

	// Format file size to human-readable format
	const formatFileSize = (bytes) => {
		if (!bytes) return 'Unknown';
		const mb = bytes / (1024 * 1024);
		return `${mb.toFixed(2)} MB`;
	};

	// Format duration to minutes:seconds
	const formatDuration = (seconds) => {
		if (!seconds) return 'Unknown';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	};

	// Determine if the delete button should be shown
	// For home page (local videos): always show
	// For shared page: only show for videos owned by the user
	const showDeleteButton = !isSharedVideo || (isSharedVideo && isOwnVideo === true);
	
	// Determine if the edit button should be shown (only on home page)
	const showEditButton = !isSharedVideo;
	
	// Determine if the upload button should be shown (only on home page)
	const showUploadButton = !isSharedVideo;

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
				
				{/* Display username if requested */}
				{renderUsername && username && (
					<div className="uploader-info">
						Uploaded by: {username}
					</div>
				)}
				
				<div className="video-actions">
					{/* Info button (for shared page) */}
					{renderInfo && (
						<button
							onClick={handleInfoClick}
							className="info-button"
							aria-label={`Info for ${title}`}
						>
							Info
						</button>
					)}
					
					{/* Copy Link button: only for shared videos */}
					{renderInfo && isSharedVideo && (
						<button
							onClick={handleCopyClick}
							className="copy-button"
							aria-label={`Copy link for ${title}`}
							style={{ marginLeft: '2px' }}
						>
							Copy Link
						</button>
					)}
					
					{/* Upload button - only for local videos */}
					{showUploadButton && (
						<button
							onClick={handleUpload}
							className="upload-button"
							aria-label={`Upload ${title}`}
							disabled={uploading}
						>
							{uploading ? 'Uploading...' : 'Upload'}
						</button>
					)}
					
					{/* Edit button - only for local videos */}
					{showEditButton && (
						<button
							onClick={handleEditClick}
							className="edit-button"
							aria-label={`Edit ${title}`}
						>
							Edit
						</button>
					)}
					
					{/* Delete button - show for local videos or if shared video is owned by user */}
					{showDeleteButton && (
						<button
							onClick={handleDeleteClick}
							className="delete-button"
							aria-label={`Delete ${title}`}
						>
							Delete
						</button>
					)}
				</div>
			</div>
			
			{/* Show metadata if toggled */}
			{showMetadata && metadata && (
				<div className="video-metadata">
					<p><strong>ID:</strong> {id}</p>
					<p><strong>Resolution:</strong> {metadata.resolution || 'Unknown'}</p>
					<p><strong>Duration:</strong> {formatDuration(metadata.duration)}</p>
					<p><strong>Size:</strong> {formatFileSize(metadata.size)}</p>
					{metadata.createdAt && (
						<p><strong>Uploaded:</strong> {new Date(metadata.createdAt).toLocaleDateString()}</p>
					)}
				</div>
			)}
			
			{/* Notification display */}
			{notification.visible && (
				<div className={`notification ${notification.type}`}>
					{notification.message}
				</div>
			)}
			
			{/* Delete confirmation modal */}
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
						<p>Are you sure you want to upload "{title}"?</p>
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
		prevProps.isActive === nextProps.isActive &&
		prevProps.showMetadata === nextProps.showMetadata &&
		prevProps.isOwnVideo === nextProps.isOwnVideo &&
		prevProps.isSharedVideo === nextProps.isSharedVideo
);
