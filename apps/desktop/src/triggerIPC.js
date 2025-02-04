// File To Handle IPC Communication Between The App.JSX & Main.JS

// Anonymous Function To Send Triggers To Main.JS
export const triggerIPC = async (trigger) => {
	try {
		// Call the method exposed in preload.js to trigger the IPC
		await window.electron.execTrigger('trigger-record');
	} catch (error) {
		console.error('Failed to trigger IPC:', error);
	}
};
