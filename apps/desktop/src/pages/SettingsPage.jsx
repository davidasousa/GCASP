import React, { useState, useEffect, useRef } from 'react';
import '../styles/index.css';

const SettingsPage = () => {
	// State for settings
	const [hotkey, setHotkey] = useState('F9');
	const [isListening, setIsListening] = useState(false);
	const [recordingLength, setRecordingLength] = useState(20);
	const [recordingLengthInput, setRecordingLengthInput] = useState('20'); // Separate state for input
	const [isSaving, setSaving] = useState(false);
	const [savedMessage, setSavedMessage] = useState('');
	
	// States for resolution, FPS, and monitors
	const [availableResolutions, setAvailableResolutions] = useState([]);
	const [selectedResolution, setSelectedResolution] = useState({ width: 1920, height: 1080 });
	const [selectedFPS, setSelectedFPS] = useState(30);
	const [monitors, setMonitors] = useState([]);
	const [selectedMonitor, setSelectedMonitor] = useState("0");
	
	// State for minimize to tray setting
	const [minimizeToTray, setMinimizeToTray] = useState(true);
	
	const hotkeyInputRef = useRef(null);

	// Load settings, screen dimensions, and monitors when component mounts
	useEffect(() => {
		const loadSettingsAndMonitors = async () => {
			try {
				// Load monitors first
				const monitorsList = await window.electron.getMonitors();
				setMonitors(monitorsList);
				window.electron.log.debug('Monitors loaded', { count: monitorsList.length });
				
				// Load screen dimensions
				const screenDimensions = await window.electron.getScreenDimensions();
				window.electron.log.debug('Screen dimensions loaded', screenDimensions);
				
				// Generate available resolutions based on screen dimensions
				const resolutions = generateAvailableResolutions(
					screenDimensions.width, 
					screenDimensions.height,
					screenDimensions.scaleFactor // Pass the scale factor if available
				);
				setAvailableResolutions(resolutions);
				window.electron.log.debug('Available resolutions generated', { count: resolutions.length });
				
				// Then load settings (using cached settings from main process)
				const settings = await window.electron.getSettings();
				window.electron.log.debug('Settings loaded for SettingsPage', settings);
				
				if (settings) {
					setHotkey(settings.hotkey || 'F9');
					const savedLength = settings.recordingLength || 20;
					setRecordingLength(savedLength);
					setRecordingLengthInput(savedLength.toString());
					
					// Set resolution and FPS from saved settings
					if (settings.resolution) {
						setSelectedResolution(settings.resolution);
					} else {
						// Default to highest available resolution
						setSelectedResolution(resolutions[0] || { width: 1920, height: 1080 });
					}
					
					setSelectedFPS(settings.fps || 30);
					setSelectedMonitor(settings.selectedMonitor || "0");
					
					// Set minimize to tray setting
					setMinimizeToTray(settings.minimizeToTray !== undefined ? settings.minimizeToTray : true);
					
					window.electron.log.debug('Settings state updated in SettingsPage component');
				}
			} catch (error) {
				console.error('Error loading settings, screen dimensions, or monitors:', error);
				window.electron.log.error('Error initializing SettingsPage', { error: error.toString() });
			}
		};

		loadSettingsAndMonitors();
		
	}, []);

	// Generate available resolutions based on screen dimensions
	const generateAvailableResolutions = (screenWidth, screenHeight, scaleFactor = 1) => {
		const screenAspectRatio = screenWidth / screenHeight;
		
		// Common standards - always include these regardless of screen size
		const standardResolutions = [
			{ width: 1920, height: 1080 }, // 1080p (always include)
			{ width: 1280, height: 720 },  // 720p (always include)
			{ width: 854, height: 480 }    // 480p (always include)
		];
		
		// Higher resolutions - only include if they'd fit on screen
		const higherResolutions = [
			{ width: 3840, height: 2160 }, // 4K UHD
			{ width: 2560, height: 1440 }, // 1440p
		];
		
		// Create a map to track which resolutions to include (prevents duplicates)
		const resolutionMap = new Map();
		
		// If scaleFactor is > 1, we have a scaled display, and the actual physical resolution
		// might be higher than what screenWidth and screenHeight report
		// Estimate physical dimensions by accounting for scaling
		const estimatedPhysicalWidth = Math.round(screenWidth * scaleFactor);
		const estimatedPhysicalHeight = Math.round(screenHeight * scaleFactor);
		
		// If we detected a substantial scaling factor and the estimated dimensions look like
		// a standard resolution, add it as a "Physical" option
		if (scaleFactor > 1.1) { // Threshold to avoid rounding errors
			// Special case for common resolutions with scaling
			// Check common physical resolutions that match the estimated dimensions
			const commonPhysicalResolutions = [
				{ width: 1920, height: 1080 }, // 1080p
				{ width: 2560, height: 1440 }, // 1440p
				{ width: 3840, height: 2160 }, // 4K
			];
			
			// Find if our estimated dimensions approximately match any common resolution
			// Allow small differences to account for scaling calculation imprecision
			const tolerance = 50; // pixels
			for (const res of commonPhysicalResolutions) {
				if (Math.abs(estimatedPhysicalWidth - res.width) <= tolerance && 
					Math.abs(estimatedPhysicalHeight - res.height) <= tolerance) {
					// We found a close match to a standard resolution - use exact values
					const physicalKey = `${res.width}x${res.height}`;
					resolutionMap.set(physicalKey, {
						width: res.width,
						height: res.height,
						label: `${res.width}x${res.height} (Physical)`,
						isNative: false,
						isPhysical: true
					});
					break;
				}
			}
		}
		
		// Add detected resolution (what Electron sees - may be scaled)
		const nativeKey = `${screenWidth}x${screenHeight}`;
		resolutionMap.set(nativeKey, { 
			width: screenWidth, 
			height: screenHeight, 
			label: `${screenWidth}x${screenHeight}${scaleFactor > 1.1 ? ' (Scaled)' : ' (Native)'}`,
			isNative: true
		});
		
		// Add standard resolutions - always include these
		standardResolutions.forEach(res => {
			const key = `${res.width}x${res.height}`;
			
			// Skip if already added
			if (resolutionMap.has(key)) return;
			
			resolutionMap.set(key, {
				width: res.width,
				height: res.height,
				label: `${res.width}x${res.height}`,
				isNative: false
			});
		});
		
		// Add higher resolutions if they match aspect ratio and fit within the screen
		// Use the higher of detected or estimated physical size to be safe
		const maxWidth = Math.max(screenWidth, estimatedPhysicalWidth);
		const maxHeight = Math.max(screenHeight, estimatedPhysicalHeight);
		
		higherResolutions.forEach(res => {
			const key = `${res.width}x${res.height}`;
			
			// Skip if already added
			if (resolutionMap.has(key)) return;
			
			// Check aspect ratio similarity
			const resAspectRatio = res.width / res.height;
			const aspectRatioDiff = Math.abs(resAspectRatio - screenAspectRatio) / screenAspectRatio;
			const isAspectRatioCompatible = aspectRatioDiff <= 0.05;
			
			// Only add higher resolutions if:
			// 1. They fit on the screen (accounting for possible scaling)
			// 2. They have a compatible aspect ratio
			if (res.width <= maxWidth && res.height <= maxHeight && isAspectRatioCompatible) {
				resolutionMap.set(key, {
					width: res.width,
					height: res.height,
					label: `${res.width}x${res.height}`,
					isNative: false
				});
			}
		});
		
		// Convert map to array and sort
		const resolutions = Array.from(resolutionMap.values()).sort((a, b) => {
			// Native resolution always first
			if (a.isNative && !b.isNative) return -1;
			if (!a.isNative && b.isNative) return 1;
			
			// Physical resolution next (if we detected one)
			if (a.isPhysical && !b.isPhysical) return -1;
			if (!a.isPhysical && b.isPhysical) return 1;
			
			// Then sort by total pixel count (largest to smallest)
			return (b.width * b.height) - (a.width * a.height);
		});
		
		return resolutions;
	};

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
	
	// Handle resolution change
	const handleResolutionChange = (e) => {
		const [width, height] = e.target.value.split('x').map(Number);
		setSelectedResolution({ width, height });
	};
	
	// Handle FPS change
	const handleFPSChange = (e) => {
		setSelectedFPS(Number(e.target.value));
	};
	
	// Handle monitor change
	const handleMonitorChange = (e) => {
		setSelectedMonitor(e.target.value);
	};
	
	// Handle minimize to tray toggle
	const handleMinimizeToTrayChange = (e) => {
		setMinimizeToTray(e.target.checked);
	};

	// Save settings
	const saveSettings = async () => {
		setSaving(true);
		setSavedMessage('');
		window.electron.log.info('Saving settings from SettingsPage');
		
		// First make sure recording length is valid by triggering blur validation
		handleRecordingLengthBlur();
		
		try {
			const settings = {
				hotkey,
				recordingLength,
				resolution: selectedResolution,
				fps: selectedFPS,
				selectedMonitor,
				minimizeToTray
			};
			
			window.electron.log.debug('Saving new settings', settings);
			
			const result = await window.electron.saveSettings(settings);
			
			// Toggle tray functionality if setting changed
			try {
				await window.electron.toggleTrayEnabled(minimizeToTray);
			} catch (error) {
				window.electron.log.error('Error toggling tray functionality', { error: error.toString() });
			}
			
			if (result.success) {
				setSavedMessage('Settings saved successfully!');
				window.electron.log.info('Settings saved successfully from SettingsPage');
			} else {
				setSavedMessage('Failed to save settings');
				window.electron.log.error('Failed to save settings', { 
					error: result.error || 'Unknown error' 
				});
			}
			
			// Clear saved message after 3 seconds
			setTimeout(() => {
				setSavedMessage('');
			}, 3000);
		} catch (error) {
			setSavedMessage(`Error saving settings: ${error.message}`);
			window.electron.log.error('Error saving settings', { error: error.toString() });
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
				
				{/* Resolution Settings */}
				<div className="settings-group">
					<h3>Video Resolution</h3>
					<div className="resolution-selector">
						<label htmlFor="resolution-select">Capture Resolution:</label>
						<select 
							id="resolution-select"
							value={`${selectedResolution.width}x${selectedResolution.height}`}
							onChange={handleResolutionChange}
							className="settings-select"
						>
							{availableResolutions.map((res, index) => (
								<option key={index} value={`${res.width}x${res.height}`}>
									{res.label || `${res.width}x${res.height}`}
								</option>
							))}
						</select>
					</div>
					<p className="setting-help">
						Select the resolution for your recordings. Higher resolutions provide better quality but require more system resources.
					</p>
					<p className="setting-warning">
						Changing resolution will restart the recording buffer. Your current cached recordings will be cleared.
					</p>
				</div>
				
				{/* Frame Rate Settings */}
				<div className="settings-group">
					<h3>Frame Rate</h3>
					<div className="fps-selector">
						<label htmlFor="fps-select">Frames Per Second:</label>
						<select 
							id="fps-select"
							value={selectedFPS}
							onChange={handleFPSChange}
							className="settings-select"
						>
							<option value="30">30 FPS</option>
							<option value="60">60 FPS</option>
						</select>
					</div>
					<p className="setting-help">
						Select the frame rate for your recordings. 60 FPS provides smoother motion but requires more processing power.
					</p>
					<p className="setting-warning">
						Changing frame rate will restart the recording buffer.
					</p>
				</div>
				
				{/* Monitor Selection */}
				<div className="settings-group">
					<h3>Monitor Selection</h3>
					<div className="monitor-selector">
						<label htmlFor="monitor-select">Select Monitor to Record:</label>
						<select 
							id="monitor-select"
							value={selectedMonitor}
							onChange={handleMonitorChange}
							className="settings-select"
						>
							{monitors.map((monitor) => (
								<option key={monitor.id} value={monitor.id}>
									{monitor.name} ({monitor.width}x{monitor.height})
								</option>
							))}
						</select>
					</div>
					<p className="setting-help">
						Choose which monitor to record. The application will capture video from the selected display.
					</p>
					<p className="setting-warning">
						Changing monitor selection will restart the recording buffer.
					</p>
				</div>
				
				{/* System Tray Setting */}
				<div className="settings-group">
					<h3>System Tray Behavior</h3>
					<div className="tray-setting">
						<label htmlFor="minimize-to-tray" className="checkbox-label">
							<input
								id="minimize-to-tray"
								type="checkbox"
								checked={minimizeToTray}
								onChange={handleMinimizeToTrayChange}
							/>
							Minimize to system tray instead of closing
						</label>
					</div>
					<p className="setting-help">
						When enabled, closing the application window will minimize it to the system tray instead of quitting. 
						The application will continue to run in the background, allowing you to use hotkeys for clipping.
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