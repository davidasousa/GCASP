import React, { useState, useEffect, useRef } from 'react';
import '../app.css';

const SettingsPage = () => {
    // State for hotkey settings
    const [hotkey, setHotkey] = useState('F9');

		// Recorder State
    const [isListening, setIsListening] = useState(false);
    const [isSaving, setSaving] = useState(false);

		// User Settings -> Input For Clamping & Error Detection
    const [recordingLength, setRecordingLength] = useState(20);
    const [pixelWidth, setPixelWidth] = useState(1080);
    const [pixelHeight, setPixelHeight] = useState(1080);
    const [fps, setFps] = useState(30);

    const [recordingLengthInput, setRecordingLengthInput] = useState('20');
    const [pixelWidthInput, setPixelWidthInput] = useState('1080');
    const [pixelHeightInput, setPixelHeightInput] = useState('1080');
    const [fpsInput, setFpsInput] = useState(30);

		// Displayed Message Buffer
    const [savedMessage, setSavedMessage] = useState('');
    
		// Recording Button
    const hotkeyInputRef = useRef(null);

    // Load settings when component mounts
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const settings = await window.electron.getSettings();
                if (settings) {
										// Loading User Settings
                    setHotkey(settings.hotkey);
                    const savedRecordingLength = settings.recordingLength;
                    const savedPixelWidth = settings.pixelWidth;
                    const savedPixelLength = settings.pixelHeight;
                    const savedFps = settings.fps;
										// Setting Use State Values
                    setRecordingLength(savedRecordingLength);
                    setPixelWidth(savedPixelWidth);
                    setPixelHeight(savedPixelHeight);
                    setFps(savedFps);
										// Setting Use State Inputs
                    setRecordingLengthInput(savedRecordingLength.toString());
                    setPixelWidthInput(savedPixelWidth.toString());
                    setPixelHeightInput(savedPixelHeight.toString());
                    setFpsInput(savedFps.toString());
                }
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        };

        loadSettings();
    }, []);

    // Handle start listening for new hotkey
    const handleStartListening = () => {
        setIsListening(true);
        if (hotkeyInputRef.current) {
            hotkeyInputRef.current.focus();
        }
    };

    // Handle keydown to capture new hotkey
    const handleKeyDown = (e) => {
        if (!isListening) return;
        
        // Prevent default browser behavior for these keys
        e.preventDefault();
        
        // Get key name
        let newHotkey = '';
        
        // Handle special keys
        if (e.key === ' ') {
            newHotkey = 'Space';
        } else if (e.key === 'Escape') {
            // Cancel listening on Escape
            setIsListening(false);
            return;
        } else if (e.key.length === 1) {
            // For single character keys, use uppercase
            newHotkey = e.key.toUpperCase();
        } else {
            // For other keys (like F1-F12, etc.)
            newHotkey = e.key;
        }
        
        // Update state
        setHotkey(newHotkey);
        setIsListening(false);
    };

    // Handle recording length input change without immediate clamping
    const handleRecordingLengthInputChange = (e) => {
        setRecordingLengthInput(e.target.value);
    };
    // Handle blur event to validate and clamp the input
    const handleRecordingLengthBlur = () => {
        const value = parseInt(recordingLengthInput, 10);
        
        if (isNaN(value)) {
            // Reset to current valid value
            setRecordingLengthInput(recordingLength.toString());
        } else {
            // Clamp between 5 and 120 seconds
            const clampedValue = Math.max(5, Math.min(120, value));
            setRecordingLength(clampedValue);
            setRecordingLengthInput(clampedValue.toString());
        }
    };
    // Handle Enter key press in recording length input
    const handleRecordingLengthKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleRecordingLengthBlur();
        }
    };

		// Handle Setting Video Dimensions
    const handlePixelWidthInputChange = (e) => {
        setPixelWidthInput(e.target.value);
    };

    const handlePixelHeightInputChange = (e) => {
        setPixelHeightInput(e.target.value);
    };

		// Handle Setting Fps
    const handleFpsInputChange = (e) => {
        setFpsInput(e.target.value);
    };

    // Save settings
    const saveSettings = async () => {
        setSaving(true);
        setSavedMessage('');
        
        // First make sure recording length is valid by triggering blur validation
        handleRecordingLengthBlur();
        
        try {
            const settings = {
                hotkey,
                recordingLength,
								pixelWidth,
								pixelHeight,
								fps
            };
            
            const result = await window.electron.saveSettings(settings);
            if (result.success) {
                setSavedMessage('Settings saved successfully!');
            } else {
                setSavedMessage('Failed to save settings');
            }
            
            // Clear saved message after 3 seconds
            setTimeout(() => {
                setSavedMessage('');
            }, 3000);
        } catch (error) {
            setSavedMessage(`Error saving settings: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="settings-page">
            <h2>Settings</h2>
            
            <div className="settings-container">
                {/* Hotkey Settings */}
                <div className="settings-group">
                    <h3>Clip Hotkey</h3>
                    <div className="hotkey-selector">
                        <label htmlFor="hotkey-input">Current Hotkey:</label>
                        <div className="hotkey-input-container">
                            <input
                                id="hotkey-input"
                                ref={hotkeyInputRef}
                                type="text"
                                value={hotkey}
                                readOnly
                                onKeyDown={handleKeyDown}
                                className={isListening ? 'listening' : ''}
                            />
                            <button 
                                onClick={handleStartListening}
                                disabled={isListening}
                            >
                                {isListening ? 'Press any key...' : 'Change Hotkey'}
                            </button>
                        </div>
                        <p className="hotkey-help">
                            {isListening 
                                ? 'Press any key. Press Escape to cancel.' 
                                : 'Click "Change Hotkey" and press the key you want to use for clip recording.'}
                        </p>
                    </div>
                </div>
                
                {/* Recording Length Settings */}
                <div className="settings-group">
                    <h3>Recording Length</h3>
                    <div className="recording-length-setter">
                        <label htmlFor="recording-length">Clip Length (seconds):</label>
                        <input
                            id="recording-length"
                            type="number"
                            min="5"
                            max="120"
                            value={recordingLengthInput}
                            onChange={handleRecordingLengthInputChange}
                            onBlur={handleRecordingLengthBlur}
                            onKeyDown={handleRecordingLengthKeyDown}
                        />
                    </div>
										{/* Pixel Width & Height */}
                    <h3>Video Width</h3>
                    <div className="video-width-setter">
                        <label htmlFor="video-width">Video Width (px):</label>
                        <input
                            id="video-width"
                            type="number"
                            min="480"
                            max="1080"
                            value={pixelWidthInput}
                            onChange={handlePixelWidthInputChange} 	
                        />
                    </div>
                    <h3>Video Height</h3>
                    <div className="video-Height-setter">
                        <label htmlFor="video-height">Video Width (px):</label>
                        <input
                            id="video-height"
                            type="number"
                            min="480"
                            max="1080"
                            value={pixelHeightInput}
                            onChange={handlePixelHeightInputChange} 	
                        />
                    </div>
                    <h3>Framerate</h3>
                    <div className="fps-setter">
                        <label htmlFor="fps">Framerate:</label>
                        <input
                            id="fps"
                            type="number"
                            min="10"
                            max="60"
                            value={fpsInput}
                            onChange={handleFpsInputChange} 	
                        />
                    </div>
                    <p className="setting-help">
                        Set how many seconds of gameplay will be saved when you press the clip hotkey (5-120 seconds).
                    </p>
                </div>
                
                {/* Save Button */}
                <div className="settings-actions">
                    <button
                        onClick={saveSettings}
                        disabled={isSaving}
                        className="save-settings-button"
                    >
                        {isSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                    
                    {savedMessage && (
                        <div className={`save-message ${savedMessage.includes('Error') ? 'error' : 'success'}`}>
                            {savedMessage}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
