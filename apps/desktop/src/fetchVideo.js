// Trigger The Video Being Sent -> Preload IPC
export const fetchVideo = async (path, videoID) => {
	try {
		await window.electron.triggerFetchVideo(path, videoID);
		
		// Fetch the video from the server
		const response = await fetch(`http://localhost:3001/video/${videoID}`);

		console.log('Status Code', response.status);

		if(response.ok) {
			// Convert the response into a Blob and create an object URL
			const videoBlob = await response.blob();
			const videoURL = URL.createObjectURL(videoBlob); 
			return videoURL; // Return the video URL
		}
	} catch (error) {
		console.error('Error fetching video:', error);
		throw error;
	}
};
