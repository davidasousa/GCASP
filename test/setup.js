// test/setup.js
import '@testing-library/jest-dom';

// Add TextEncoder and TextDecoder to global scope for tests
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Mock Electron APIs that will be needed by components
window.electron = {
    // Settings functions
    getSettings: jest.fn().mockResolvedValue({
        hotkey: 'F9',
        recordingLength: 20,
        resolution: { width: 1920, height: 1080 },
        fps: 30,
        selectedMonitor: "0"
    }),
    saveSettings: jest.fn().mockResolvedValue({ success: true }),
    onSettingsChanged: jest.fn(),

    // Screen dimensions
    getScreenDimensions: jest.fn().mockResolvedValue({ width: 1920, height: 1080 }),

    // Get all monitors
    getMonitors: jest.fn().mockResolvedValue([
        { id: "0", name: "Monitor 1 (Primary)", width: 1920, height: 1080, x: 0, y: 0, isPrimary: true }
    ]),

  // Get list of local videos
    getLocalVideos: jest.fn().mockResolvedValue([
        { id: 'clip_123', filename: 'test_video.mp4', timestamp: new Date() }
    ]),

    // Remove All Local Videos
    removeLocalClips: jest.fn().mockResolvedValue({ success: true }),

    // Trigger video recording (for buffer)
    triggerRecordVideo: jest.fn().mockResolvedValue({ id: 'clip_123', filename: 'test_video.mp4', timestamp: new Date() }),

    // Remove specific video
    removeSpecificVideo: jest.fn().mockResolvedValue({ success: true }),

    // Trigger video clipping with splicing
    triggerClipVideo: jest.fn().mockResolvedValue({ success: true, filename: 'clip_123.mp4' }),

  // Get video metadata (for editing)
    getVideoMetadata: jest.fn().mockResolvedValue({
        width: 1920,
        height: 1080,
        duration: 30,
        format: 'mp4',
        size: 10485760, // 10MB in bytes
        codec: 'h264'
    }),

    // Save edited video
    saveEditedVideo: jest.fn().mockResolvedValue({ success: true }),
    // Event listeners (we implement these as jest functions that can be called directly in tests)
    onNewRecording: jest.fn(),
    onRecordingDone: jest.fn(),
    onClipDone: jest.fn(),

  // Logging functions for renderer process
    log: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    }
};

// Set up mocks for react-router-dom
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => jest.fn(),
    useParams: () => ({ videoId: 'test_video' }),
    useLocation: () => ({ pathname: '/' })
}));

// Define global test utilities
global.flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

// Clean up mocks after each test
afterEach(() => {
    jest.clearAllMocks();
});