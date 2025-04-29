import { API_URL } from '../config';

// Base configuration for API services
const config = {
	// baseUrl will be set once you call init()
	baseUrl: null,

	// Initialize base configuration
	init() {
		this.baseUrl = API_URL;
		if (window.electron?.log) {
			window.electron.log.info('API Service initialized with URL:', { url: this.baseUrl });
		} else {
			console.log('API Service URL:', this.baseUrl);
		}
	},

	// Handle API errors consistently
	handleError(error, context) {
		// Log error using Electron logger if available
		if (window.electron?.log) {
			window.electron.log.error(`API Error (${context})`, {
				error: error.toString(),
				...(error.response
					? { status: error.response.status, data: error.response.data }
					: {}),
			});
		} else {
			console.error(`API Error (${context}):`, error);
		}

		// Extract the most useful error message
		let message = 'An unexpected error occurred';
		if (error.response?.data?.message) {
			message = error.response.data.message;
		} else if (error.message) {
			message = error.message;
		}

		// Rethrow with useful message
		throw new Error(message);
	},
};

export default config;
