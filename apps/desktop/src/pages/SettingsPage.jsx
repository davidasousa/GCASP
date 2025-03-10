import React, { useState, useEffect, useRef } from 'react';
import '../app.css';

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

	// State For Possible Application Inputs
	const [runningProcesses, setRunningProcesses] = useState([]);
	const [selectedProcess, setSelectedProcess] = useState("Full Screen");
	const [areProcessesReady, setAreProcessesReady] = useState(false)

	
	const hotkeyInputRef = useRef(null);

	// Load settings, screen dimensions, and monitors when component mounts
	useEffect(() => {
		const loadSettingsAndMonitors = async () => {
			try {
				// Load monitors first
				const monitorsList = await window.electron.getMonitors();
				setMonitors(monitorsList);
				
				// Load screen dimensions
				const screenDimensions = await window.electron.getScreenDimensions();
				
				// Generate available resolutions based on screen dimensions
				const resolutions = generateAvailableResolutions(screenDimensions.width, screenDimensions.height);
				setAvailableResolutions(resolutions);
				
				// Then load settings
				const settings = await window.electron.getSettings();
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
				}
			} catch (error) {
				console.error('Error loading settings, screen dimensions, or monitors:', error);
			}
		};

		loadSettingsAndMonitors();
	}, []);

	useEffect(() => {
		const loadProcesses = async () => {
			const processes = await window.electron.fetchRunningProcesses();
			setRunningProcesses(processes);
			setAreProcessesReady(true);
		}

		loadProcesses();
	}, []);

	// Generate available resolutions based on screen dimensions
	const generateAvailableResolutions = (screenWidth, screenHeight) => {
		const screenAspectRatio = screenWidth / screenHeight;
		
		// Common resolution options
		const commonResolutions = [
			{ width: 1920, height: 1080 }, // 1080p
			{ width: 1280, height: 720 },  // 720p
			{ width: 854, height: 480 },   // 480p
		];
		
		// Start with native resolution
		const resolutions = [
			{ 
				width: screenWidth, 
				height: screenHeight, 
				label: `${screenWidth}x${screenHeight} (Native)` 
			}
		];
		
		// Add common resolutions that are smaller than screen and have similar aspect ratio
		commonResolutions.forEach(res => {
			if (res.width <= screenWidth && res.height <= screenHeight) {
				const resAspectRatio = res.width / res.height;
				// Check if aspect ratio is within 5% tolerance
				const aspectRatioDiff = Math.abs(resAspectRatio - screenAspectRatio) / screenAspectRatio;
				
				if (aspectRatioDiff <= 0.05) {
					resolutions.push({
						width: res.width,
						height: res.height,
						label: `${res.width}x${res.height}`
					});
				}
			}
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

	// Handle Application Change
	const handleApplicationChange = (e) => {
		setSelectedProcess(e.target.value);
	};

	// Save settings
	const saveSettings = async () => {
		setSaving(true);
		setSavedMessage('');
		
		// First make sure recording length is valid by triggering blur validation
		handleRecordingLengthBlur();
		
		try {
			const settings = {
				hotkey: hotkey,
				clipLength: recordingLength,
				selectedResolution: selectedResolution,
				selectedFPS: selectedFPS,
				selectedMonitor: selectedMonitor,
				selectedApp: selectedProcess
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

				{/* Conditional rendering directly in JSX */}
				<div className="settings-group">
					<h3>Application Selection</h3>
					<div className="application-selector">
						<label htmlFor="application-select">Select Application to Record:</label>

						{/* Conditional rendering of the select dropdown or loading state */}
						{areProcessesReady ? (
							<select 
								id="application-select"
								onChange={handleApplicationChange}
							>
								{runningProcesses.map((process, index) => (
									<option key={index} value={process}>
										{process}
									</option>
								))}
							</select>
						) : (
							<div>Loading processes...</div> // Fallback loading message when not ready
						)}
					</div>
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
