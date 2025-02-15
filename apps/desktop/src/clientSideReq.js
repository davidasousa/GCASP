// Client Side Video Handeling 

// Fetch Video Given Recording Timestamp
export const fetchVideo = async (videoTimestamp) => {
	try {
		// Trigger Server Handeling
		await window.electron.triggerFetchRecording(videoTimestamp);
		
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

// Call The Record Video IPC Function -> In Preload.JS
export const recordVideo = async () => {
	try { await window.electron.triggerRecordVideo(); } 
	catch (error) { console.error('Failed to trigger IPC:', error); }
};

// Record All Previous Videos
export const fetchPrevVideos = async () => {
	try { await window.electron.triggerFetchPrevVideos(); } 
	catch (error) { console.error('Failed to trigger IPC:', error); }
};
