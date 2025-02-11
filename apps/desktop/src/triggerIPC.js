// Anonymous Function To Send Triggers To Main.JS
export const triggerRecordVideo = async () => {
	try {
		await window.electron.recordVideo();
	} catch (error) {
		console.error('Failed to trigger IPC:', error);
	}
};
