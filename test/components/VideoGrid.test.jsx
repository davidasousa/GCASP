import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import VideoGrid from '../../apps/desktop/src/components/VideoGrid';

// The mock renders a div with a test id and displays the title along with an "active" marker if active.
jest.mock('../../apps/desktop/src/components/VideoContainer', () => {
	return jest.fn((props) => (
		<div data-testid="video-container" onClick={props.onActivate}>
			{props.title} {props.isActive ? 'active' : ''}
		</div>
	));
});
import VideoContainer from '../../apps/desktop/src/components/VideoContainer';

describe('VideoGrid Component', () => {
	const videos = [
		{ id: '1', title: 'Video 1', videoUrl: 'url1' },
		{ id: '2', title: 'Video 2', videoUrl: 'url2' },
		{ id: '3', title: 'Video 3', videoUrl: 'url3' }
	];
	const mockOnDelete = jest.fn();

	beforeEach(() => {
		jest.clearAllMocks();
	});

	test('renders correct number of video containers', () => {
		render(<VideoGrid videos={videos} onDelete={mockOnDelete} />);
		const containers = screen.getAllByTestId('video-container');
		expect(containers).toHaveLength(videos.length);
	});

	test('initially, no video is active', () => {
		render(<VideoGrid videos={videos} onDelete={mockOnDelete} />);
		const containers = screen.getAllByTestId('video-container');
		containers.forEach((container) => {
			expect(container.textContent).not.toMatch(/active/);
		});
	});

	test('activates video when a video container is clicked', () => {
		render(<VideoGrid videos={videos} onDelete={mockOnDelete} />);
		const containers = screen.getAllByTestId('video-container');
		// Simulate clicking on the second video container
		fireEvent.click(containers[1]);
		// After clicking, the second container should show "active"
		expect(containers[1].textContent).toMatch(/active/);
		// The others should not have the active state
		expect(containers[0].textContent).not.toMatch(/active/);
		expect(containers[2].textContent).not.toMatch(/active/);
	});

	test('passes onDelete callback to each video container', () => {
		render(<VideoGrid videos={videos} onDelete={mockOnDelete} />);
		// Verify that VideoContainer was called once for each video
		expect(VideoContainer).toHaveBeenCalledTimes(videos.length);
		VideoContainer.mock.calls.forEach((call) => {
			const props = call[0];
			expect(props.onDelete).toBe(mockOnDelete);
		});
	});
});
