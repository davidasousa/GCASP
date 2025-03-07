import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { globalShortcut } from 'electron';

// Define path for GCASP settings
const gcaspDataPath = path.join(app.getPath('appData'), 'GCASP');
const settingsPath = path.join(gcaspDataPath, 'settings.json');

// Default settings
const defaultSettings = {
    hotkey: 'F9',
    recordingLength: 20, // seconds
		pixelWidth: 1080,
		pixelHeight: 1920,
		fps: 30
};

// Load settings from the settings file
export function loadSettings() {
    try {
        // Check if settings file exists
        if (fs.existsSync(settingsPath)) {
            const settingsData = fs.readFileSync(settingsPath, 'utf8');
            const settings = JSON.parse(settingsData);
            
            // Merge with default settings to ensure all properties exist
            return { ...defaultSettings, ...settings };
        }
        
        // If file doesn't exist, return default settings
        return defaultSettings;
    } catch (error) {
        console.error('Error loading settings:', error);
        return defaultSettings;
    }
}


// Save settings to the settings file
export function saveSettings(settings) {
    try {
        // Merge with existing settings to avoid overwriting unrelated settings
        const existingSettings = loadSettings();
        const updatedSettings = { ...existingSettings, ...settings };
        
        // Write settings to file
        fs.writeFileSync(settingsPath, JSON.stringify(updatedSettings, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
}

// Ensure the settings directory exists
export function ensureSettingsDirectory() {
    try {
        // Create GCASP directory if it doesn't exist
        if (!fs.existsSync(gcaspDataPath)) {
            fs.mkdirSync(gcaspDataPath, { recursive: true });
            console.log(`Created GCASP settings directory at: ${gcaspDataPath}`);
        }
    } catch (error) {
        console.error('Error creating settings directory:', error);
    }
}

// Initialize settings when app starts
export function initSettings() {
    ensureSettingsDirectory();
    
    // If settings file doesn't exist, create it with default settings
    if (!fs.existsSync(settingsPath)) {
        saveSettings(defaultSettings);
    }
    
    return loadSettings();
}
