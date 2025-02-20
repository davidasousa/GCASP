export const loadVideos = async (setVideos) => {
		try {
				const localVideos = await window.electron.getLocalVideos();
				const processedVideos = localVideos.map(video => ({
						id: video.id,
						title: video.filename,
						videoUrl: `gcasp://${video.id.replace('clip_', '')}/`
				}));
				setVideos(processedVideos);
		} catch (error) {
				console.error('Error loading videos:', error);
		}
};
