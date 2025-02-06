import { triggerFetchVideo } from './triggerIPC';

export const fetchVideo = async (path) => {
	try {
		// Trigger The Video Being Sent
		triggerFetchVideo(path);
		
		// Fetch the video from the server
		const response = await fetch('http://localhost:3001/video')
			.then(response => {
				console.log('Status', response.status);
				if(response.ok) {
					const contentType = response.headers.get('Content-Type');

					// Convert the response into a Blob and create an object URL
					const videoBlob = response.blob();
					const videoURL = URL.createObjectURL(videoBlob); 
					return videoURL; // Return the video URL
				} else {
					throw new Error('BLANK');
				}
			})
	} catch (error) {
		console.error('Error fetching video:', error);
		throw error;
	}
};
