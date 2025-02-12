// File To Handle IPC Communication Between The App.JSX & Main.JS
// This File Runs In Electron/Forge

// Anonymous Function To Send Triggers To Main.JS
export const triggerIPC = async (trigger) => {
	try {
		await window.electron.execTrigger(trigger);
	} catch (error) {
		console.error('Failed to trigger IPC:', error);
	}
};

// Anonymous Function To Send Triggers To Main.JS
export const triggerFetchVideo = async (filePath) => {
	try {
		return await window.electron.fetchVideo(filePath);
	} catch (error) {
		console.error('Failed to trigger Fetch Video IPC:', error);
	}
};
