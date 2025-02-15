// Trigger The Video Being Sent -> Preload IPC
export const fetchVideo = async (videoTimestamp) => {
	try {
		// Trigger Server Handeling
		await window.electron.triggerFetchVideo(videoTimestamp);
		
		// Client Side Reception
		const response = await fetch(`http://localhost:3001/videos/${videoTimestamp}`);

		console.log('Status Code', response.status);

		if(response.ok) {
			// Convert the response into a Blob and create an object URL
			const videoBlob = await response.blob();
			const videoURL = URL.createObjectURL(videoBlob);
			return videoURL;
		}
	} catch (error) {
		console.error('Error fetching video:', error);
		throw error;
	}
};
