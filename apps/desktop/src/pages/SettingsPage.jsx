import React, { useState, useEffect, useRef } from 'react';
import '../app.css';

const SettingsPage = () => {
    // State for hotkey settings
    const [hotkey, setHotkey] = useState('F9');
    const [isListening, setIsListening] = useState(false);
    const [recordingLength, setRecordingLength] = useState(20);
    const [recordingLengthInput, setRecordingLengthInput] = useState('20'); // Separate state for input
    const [isSaving, setSaving] = useState(false);
    const [savedMessage, setSavedMessage] = useState('');
    
    const hotkeyInputRef = useRef(null);

    // Load settings when component mounts
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const settings = await window.electron.getSettings();
                if (settings) {
                    setHotkey(settings.hotkey || 'F9');
                    const savedLength = settings.recordingLength || 20;
                    setRecordingLength(savedLength);
                    setRecordingLengthInput(savedLength.toString());
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
        // Allow user to type any value
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

    // Save settings
    const saveSettings = async () => {
        setSaving(true);
        setSavedMessage('');
        
        // First make sure recording length is valid by triggering blur validation
        handleRecordingLengthBlur();
        
        try {
            const settings = {
                hotkey,
                recordingLength
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