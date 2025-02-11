export const fetchVideo = async (path) => {
	try {
		// Trigger The Video Being Sent -> Preload IPC
		await window.electron.fetchVideo(path);
		
		// Fetch the video from the server
		const response = await fetch('http://localhost:3001/video');

		console.log('Status Code', response.status);

		if(response.ok) {
			// Convert the response into a Blob and create an object URL
			const videoBlob = await response.blob();
			const videoURL = URL.createObjectURL(videoBlob); 
			return videoURL; // Return the video URL
		} else {
			throw new Error('BLANK');
		}
	} catch (error) {
		console.error('Error fetching video:', error);
		throw error;
	}
};
