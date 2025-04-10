import { ipcMain, screen } from 'electron';
import { getModuleLogger } from './logger';

const logger = getModuleLogger('ipcSystemHandlers.js');

export function setupSystemHandlers() {
    // Get screen dimensions
    logger.debug('Registering get-screen-dimensions handler');
    ipcMain.handle('get-screen-dimensions', () => {
        logger.debug('get-screen-dimensions handler called');
        try {
            const primaryDisplay = screen.getPrimaryDisplay();
            const dimensions = {
                width: primaryDisplay.bounds.width,
                height: primaryDisplay.bounds.height,
                scaleFactor: primaryDisplay.scaleFactor
            };
            logger.debug('Retrieved screen dimensions', dimensions);
            return dimensions;
        } catch (error) {
            logger.error('Error getting screen dimensions:', error);
            throw error;
        }
    });
    
    // Get all monitors
    logger.debug('Registering get-monitors handler');
    ipcMain.handle('get-monitors', async () => {
        logger.debug('get-monitors handler called');
        try {
            // Get all displays from Electron screen API
            const displays = screen.getAllDisplays();
            logger.debug(`Found ${displays.length} displays`);
            
            // Format the displays into a usable format
            const monitors = displays.map((display, index) => {
                const isPrimary = display.id === screen.getPrimaryDisplay().id;
                const monitor = {
                    id: index.toString(),
                    name: `Monitor ${index + 1}${isPrimary ? ' (Primary)' : ''}`,
                    width: display.bounds.width,
                    height: display.bounds.height,
                    x: display.bounds.x,
                    y: display.bounds.y,
                    isPrimary
                };
                logger.debug(`Mapped display ${index}`, monitor);
                return monitor;
            });
            
            logger.debug(`Returning ${monitors.length} monitors`);
            return monitors;
        } catch (error) {
            logger.error('Error getting monitors:', error);
            throw error;
        }
    });
}