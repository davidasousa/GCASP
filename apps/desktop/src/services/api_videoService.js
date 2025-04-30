import config from './api_config';
import { secureStorage } from '../utils/secureStorage';

// Video service
const videoService = {
	// Get shared videos
	async getSharedVideos(page = 1, limit = 10) {
		try {
			if (window.electron?.log) {
				window.electron.log.debug('Fetching shared videos from server', { page, limit });
			}
			
			const response = await fetch(`${config.baseUrl}/videos/shared-videos?page=${page}&limit=${limit}`);
			
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || `Error ${response.status}: Failed to fetch videos`);
			}
			
			const data = await response.json();
			
			// Add videoUrl property to each video if not already present
			const videos = data.videos.map(video => ({
				...video,
				videoUrl: video.cloudFrontUrl || video.videoUrl || `${config.baseUrl}/videos/stream/${video.id}`
			}));
			
			if (window.electron?.log) {
				window.electron.log.info('Retrieved shared videos', { 
					count: videos.length,
					page: data.pagination.currentPage,
					totalPages: data.pagination.totalPages,
				});
			}
			
			return {
				videos,
				pagination: data.pagination
			};
		} catch (error) {
			config.handleError(error, 'getSharedVideos');
		}
	},
	// Delete a video
	async deleteVideo(id, token) {
		try {
			if (window.electron?.log) {
				window.electron.log.debug('Deleting video', { id });
			}
			
			const response = await fetch(`${config.baseUrl}/videos/${id}`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				}
			});
			
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || `Error ${response.status}: Failed to delete video`);
			}
			
			if (window.electron?.log) {
				window.electron.log.info('Video deleted successfully', { id });
			}
			
			return true;
		} catch (error) {
			config.handleError(error, 'deleteVideo');
		}
	},
	
	// Hide a video (make it private)
	async hideVideo(id, token) {
		try {
			if (window.electron?.log) {
				window.electron.log.debug('Hiding video', { id });
			}
			
			const response = await fetch(`${config.baseUrl}/videos/${id}/hide`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				}
			});
			
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || `Error ${response.status}: Failed to hide video`);
			}
			
			if (window.electron?.log) {
				window.electron.log.info('Video hidden successfully', { id });
			}
			
			return true;
		} catch (error) {
			config.handleError(error, 'hideVideo');
		}
	},
	
	// Publish a video (make it public)
	async publishVideo(id, token) {
		try {
			if (window.electron?.log) {
				window.electron.log.debug('Publishing video', { id });
			}
			
			const response = await fetch(`${config.baseUrl}/videos/${id}/publish`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				}
			});
			
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || `Error ${response.status}: Failed to publish video`);
			}
			
			if (window.electron?.log) {
				window.electron.log.info('Video published successfully', { id });
			}
			
			return true;
		} catch (error) {
			config.handleError(error, 'publishVideo');
		}
	},
	
	// Upload a video
	async uploadVideo(videoTitle, token) {
		try {
			if (!window.electron?.triggerUploadClip) {
				throw new Error('Upload functionality not available');
			}
			
			window.electron.log.debug('Uploading video to server', { title: videoTitle });
			const response = await window.electron.triggerUploadClip(videoTitle, token);
			
			if (!response || !response.success) {
				throw new Error(response?.message || 'Failed to upload video');
			}
			
			window.electron.log.info('Video uploaded successfully', { title: videoTitle });
			return response;
		} catch (error) {
			config.handleError(error, 'uploadVideo');
		}
	},

    // Refresh an expired video URL
    async refreshVideoUrl(videoId) {
        try {
            const token = await secureStorage.getToken();
            
            if (!token) {
                throw new Error('Authentication required');
            }
            
            const response = await fetch(`${config.baseUrl}/videos/${videoId}/refresh-url`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Error ${response.status}: Failed to refresh video URL`);
            }
            
            const data = await response.json();
            
            return {
                id: data.id,
                cloudFrontUrl: data.cloudFrontUrl,
                videoUrl: data.cloudFrontUrl || data.videoUrl
            };
        } catch (error) {
            config.handleError(error, 'refreshVideoUrl');
        }
    }
};

export default videoService;