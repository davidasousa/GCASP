import config from './api_config';

// Friend service
const friendService = {
	// Get friends list
	async getFriendsList(token) {
		try {
			if (!window.electron?.getFriendsList) {
				throw new Error('Friends list functionality not available');
			}
			
			window.electron.log.debug('Fetching friends list');
			const result = await window.electron.getFriendsList(token);
			
			window.electron.log.debug('Retrieved friends list', { 
				count: result?.friends?.length || 0 
			});
			
			return result;
		} catch (error) {
			config.handleError(error, 'getFriendsList');
		}
	},
	
	// Add a friend
	async addFriend(friendUsername, token) {
		try {
			if (!window.electron?.addFriend) {
				throw new Error('Add friend functionality not available');
			}
			
			window.electron.log.debug('Adding friend', { username: friendUsername });
			const response = await window.electron.addFriend(friendUsername, token);
			
			if (!response.success) {
				throw new Error(response.message || 'Failed to add friend');
			}
			
			window.electron.log.info('Friend added successfully', { username: friendUsername });
			return response;
		} catch (error) {
			config.handleError(error, 'addFriend');
		}
	},
	
	// Remove a friend
	async removeFriend(friendUsername, token) {
		try {
			if (!window.electron?.removeFriend) {
				throw new Error('Remove friend functionality not available');
			}
			
			window.electron.log.debug('Removing friend', { username: friendUsername });
			const response = await window.electron.removeFriend(friendUsername, token);
			
			if (!response.success) {
				throw new Error(response.message || 'Failed to remove friend');
			}
			
			window.electron.log.info('Friend removed successfully', { username: friendUsername });
			return response;
		} catch (error) {
			config.handleError(error, 'removeFriend');
		}
	}
};

export default friendService;