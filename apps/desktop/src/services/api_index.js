import config from './api_config';
import authService from './api_authService';
import videoService from './api_videoService';
import friendService from './api_friendService';

// Combined API service
const API = {
	// Initialize all services
	init() {
		if (window.electron?.log) {
			window.electron.log.info('Initializing API services');
		}
		config.init();
		
		if (window.electron?.log) {
			window.electron.log.debug('API services initialized successfully');
		}
	},
	
	// Re-export all services
	...authService,
	...videoService,
	...friendService
};

export default API;