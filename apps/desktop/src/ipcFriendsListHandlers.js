import { ipcMain } from 'electron';
import { getModuleLogger } from './logger';
import axios from 'axios';  // Correct import for axios

const logger = getModuleLogger('ipcSettingsHandlers.js');

const DEFAULT_API_URL = 'http://localhost:5001';

// Helper to get API URL
const getApiUrl = () => {
  return process.env.API_URL || DEFAULT_API_URL;
};

// Initialize settings and register handlers
export function setupFriendsListHandlers() {
  logger.debug("Setting Up Friends List Handlers");

  // Trigger Add Friend
  logger.debug("Registering Add Friend");

  ipcMain.handle('trigger-add-friend', async (event, friendUsername, token) => {
    logger.debug('Adding Friend');
    // Send Axios Request To Backend And Return Result
      try {
        const response = await axios.post(
          `${getApiUrl()}/friends/add/${friendUsername}`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            timeout: 5000, 
          }
        );
    
        console.log("Friend added successfully:", response.data);
      } catch (error) {
        if (error.response) {
          console.error("Request failed:", error.response.data);
        } else {
          console.error("Error:", error.message);
        }
      }
    });
}

export default setupFriendsListHandlers;
