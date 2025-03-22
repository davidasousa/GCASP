import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the video.js library
jest.mock('video.js', () => {
	// Create a mock implementation that returns an object with the methods we need
	const mockPlayer = {
		on: jest.fn(),
		src: jest.fn(),
		play: jest.fn().mockResolvedValue(),
		pause: jest.fn(),
		dispose: jest.fn(),
		currentTime: jest.fn(),
		error: jest.fn(),
		load: jest.fn()
	};
	
	// Return a jest function that we can spy on that returns our mock player
	return jest.fn(() => mockPlayer);
});

// Import the styles mock to avoid import errors
jest.mock('video.js/dist/video-js.css', () => ({}));

// Import the component under test
import VideoPlayer from '../../apps/desktop/src/components/VideoPlayer';
import videojs from 'video.js';

describe('VideoPlayer Component', () => {
	// Reset all mocks before each test
	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	test('renders video element with correct class names', () => {
		const { container } = render(
			<VideoPlayer 
				videoUrl="gcasp://test-123/"
				isActive={false}
			/>
		);

		// Verify that the video element is rendered with proper classes
		const videoElement = container.querySelector('video');
		expect(videoElement).toBeInTheDocument();
		expect(videoElement).toHaveClass('video-js');
		expect(videoElement).toHaveClass('vjs-big-play-centered');
		expect(videoElement).toHaveClass('vjs-fluid');
	});

	test('initializes video.js player on mount', () => {
		render(
			<VideoPlayer 
				videoUrl="gcasp://test-123/"
				isActive={false}
			/>
		);

		// Verify that videojs was called
		expect(videojs).toHaveBeenCalledTimes(1);
		
		// Verify that it was called with a video element and options
		const callArgs = videojs.mock.calls[0];
		expect(callArgs[0]).toBeInstanceOf(HTMLVideoElement);
		expect(callArgs[1]).toHaveProperty('sources');
		expect(callArgs[1].sources[0]).toEqual({
			src: 'gcasp://test-123/',
			type: 'video/mp4'
		});
	});

	test('registers event listeners when player is ready', () => {
		// Mock the onReady callback
		const mockOnReady = jest.fn();
		
		render(
			<VideoPlayer 
				videoUrl="gcasp://test-123/"
				isActive={false}
				onReady={mockOnReady}
			/>
		);

		// Get the mock player instance
		const mockPlayer = videojs.mock.results[0].value;
		
		// The third argument to videojs() is the onPlayerReady callback
		const onPlayerReady = videojs.mock.calls[0][2];
		
		// Call the onPlayerReady function manually to simulate videojs ready event
		act(() => {
			onPlayerReady();
		});
		
		// Verify onReady callback was called with the player
		expect(mockOnReady).toHaveBeenCalledWith(mockPlayer);
		
		// Verify that event listeners were registered
		expect(mockPlayer.on).toHaveBeenCalledWith('keydown', expect.any(Function));
		expect(mockPlayer.on).toHaveBeenCalledWith('error', expect.any(Function));
	});

	test('updates video source when videoUrl prop changes', () => {
		const { rerender } = render(
			<VideoPlayer 
				videoUrl="gcasp://test-123/"
				isActive={false}
			/>
		);

		// Get the mock player instance
		const mockPlayer = videojs.mock.results[0].value;

		// Rerender with a different URL
		rerender(
			<VideoPlayer 
				videoUrl="gcasp://test-456/"
				isActive={false}
			/>
		);

		// Check if src method was called with new URL
		expect(mockPlayer.src).toHaveBeenCalledWith({
			src: 'gcasp://test-456/',
			type: 'video/mp4'
		});
		
		// And should also be called with the cache busting parameter
		expect(mockPlayer.src).toHaveBeenCalledWith(
			expect.objectContaining({
				src: expect.stringMatching(/^gcasp:\/\/test-456\/\?t=\d+$/),
				type: 'video/mp4'
			})
		);
	});

	test('plays video when isActive becomes true', () => {
		const { rerender } = render(
			<VideoPlayer 
				videoUrl="gcasp://test-123/"
				isActive={false}
			/>
		);

		// Get the mock player instance
		const mockPlayer = videojs.mock.results[0].value;

		// Initially, play should not be called
		expect(mockPlayer.play).not.toHaveBeenCalled();

		// Rerender with isActive=true
		rerender(
			<VideoPlayer 
				videoUrl="gcasp://test-123/"
				isActive={true}
			/>
		);

		// Check if play method was called
		expect(mockPlayer.play).toHaveBeenCalledTimes(1);
	});

	test('pauses video when isActive becomes false', () => {
		const { rerender } = render(
			<VideoPlayer 
				videoUrl="gcasp://test-123/"
				isActive={true}
			/>
		);

		// Get the mock player instance
		const mockPlayer = videojs.mock.results[0].value;

		// Force play method to be cleared since we're starting with isActive=true
		mockPlayer.play.mockClear();

		// Rerender with isActive=false
		rerender(
			<VideoPlayer 
				videoUrl="gcasp://test-123/"
				isActive={false}
			/>
		);

		// Check if pause method was called
		expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
	});

	test('disposes player on unmount', () => {
		const { unmount } = render(
			<VideoPlayer 
				videoUrl="gcasp://test-123/"
				isActive={false}
			/>
		);

		// Get the mock player instance
		const mockPlayer = videojs.mock.results[0].value;

		// Unmount the component
		unmount();

		// Check if dispose method was called
		expect(mockPlayer.dispose).toHaveBeenCalledTimes(1);
	});

	test('handles keyboard shortcuts through keydown event', () => {
		render(
			<VideoPlayer 
				videoUrl="gcasp://test-123/"
				isActive={false}
			/>
		);

		// Get the mock player instance
		const mockPlayer = videojs.mock.results[0].value;
		
		// Simulate the onPlayerReady callback to setup event handlers
		const onPlayerReady = videojs.mock.calls[0][2];
		act(() => {
			onPlayerReady();
		});

		// Get the keydown handler from the mock calls
		const keydownCalls = mockPlayer.on.mock.calls.filter(
			call => call[0] === 'keydown'
		);
		expect(keydownCalls.length).toBeGreaterThan(0);
		const keydownHandler = keydownCalls[0][1];

		// Mock player current state
		mockPlayer.paused = jest.fn().mockReturnValue(true);
		mockPlayer.currentTime.mockReturnValue(30);
		mockPlayer.volume = jest.fn().mockReturnValue(0.5);

		// Test spacebar - should play when paused
		keydownHandler({ code: 'Space' });
		expect(mockPlayer.paused).toHaveBeenCalled();
		expect(mockPlayer.play).toHaveBeenCalled();

		// Reset mocks
		mockPlayer.play.mockClear();
		mockPlayer.paused.mockReset().mockReturnValue(false);

		// Test spacebar - should pause when playing
		keydownHandler({ code: 'Space' });
		expect(mockPlayer.paused).toHaveBeenCalled();
		expect(mockPlayer.pause).toHaveBeenCalled();

		// Test left arrow - should rewind 5 seconds
		keydownHandler({ code: 'ArrowLeft' });
		expect(mockPlayer.currentTime).toHaveBeenCalledWith(25); // 30 - 5

		// Test right arrow - should forward 5 seconds
		keydownHandler({ code: 'ArrowRight' });
		expect(mockPlayer.currentTime).toHaveBeenCalledWith(35); // 30 + 5

		// Test up arrow - should increase volume
		keydownHandler({ code: 'ArrowUp' });
		expect(mockPlayer.volume).toHaveBeenCalledWith(0.6); // 0.5 + 0.1

		// Test down arrow - should decrease volume
		keydownHandler({ code: 'ArrowDown' });
		expect(mockPlayer.volume).toHaveBeenCalledWith(0.4); // 0.5 - 0.1
	});

	test('handles errors properly', () => {
		render(
			<VideoPlayer 
				videoUrl="gcasp://test-123/"
				isActive={false}
			/>
		);

		// Get the mock player instance
		const mockPlayer = videojs.mock.results[0].value;
		
		// Simulate the onPlayerReady callback to setup event handlers
		const onPlayerReady = videojs.mock.calls[0][2];
		act(() => {
			onPlayerReady();
		});

		// Get the error handler from the mock calls
		const errorCalls = mockPlayer.on.mock.calls.filter(
			call => call[0] === 'error'
		);
		expect(errorCalls.length).toBeGreaterThan(0);
		const errorHandler = errorCalls[0][1];

		// Mock an error object
		mockPlayer.error.mockReturnValue({
			code: 4,
			message: '416 Range Not Satisfiable'
		});

		// Simulate error event
		errorHandler();

		// Check if error recovery was attempted
		expect(mockPlayer.src).toHaveBeenCalledWith(
			expect.objectContaining({
				src: expect.stringMatching(/^gcasp:\/\/test-123\/\?reload=\d+$/),
				type: 'video/mp4'
			})
		);
		expect(mockPlayer.load).toHaveBeenCalled();
		expect(mockPlayer.on).toHaveBeenCalledWith('loadedmetadata', expect.any(Function));
	});

	test('accepts and uses custom options', () => {
		const customOptions = {
			autoplay: true,
			muted: true,
			controls: false,
			inactivityTimeout: 1000
		};

		render(
			<VideoPlayer 
				videoUrl="gcasp://test-123/"
				isActive={false}
				options={customOptions}
			/>
		);

		// Verify that videojs was called with our custom options merged
		const callArgs = videojs.mock.calls[0];
		expect(callArgs[1]).toHaveProperty('autoplay', true);
		expect(callArgs[1]).toHaveProperty('muted', true);
		expect(callArgs[1]).toHaveProperty('controls', false);
		expect(callArgs[1]).toHaveProperty('inactivityTimeout', 1000);
	});
});