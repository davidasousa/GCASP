import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock VideoPlayer with a jest.fn() to enable mockImplementation
jest.mock('../../apps/desktop/src/components/VideoPlayer', () => 
	jest.fn(props => (
		<div 
			data-testid="video-player"
			className={props.isActive ? 'active-video' : ''}
			data-video-url={props.videoUrl}
			data-options={JSON.stringify(props.options)}
		>
			Mock Video Player
		</div>
	))
);

// Mock navigate function
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
	...jest.requireActual('react-router-dom'),
	useNavigate: () => mockNavigate
}));

// Import the component under test
import VideoContainer from '../../apps/desktop/src/components/VideoContainer';

// Mock electron API
window.electron = {
	removeSpecificVideo: jest.fn().mockResolvedValue({ success: true })
};

describe('VideoContainer Component', () => {
	const mockProps = {
		id: 'video-123',
		title: 'Test Video.mp4',
		videoUrl: 'gcasp://test-123/',
		isActive: false,
		onActivate: jest.fn(),
		onDelete: jest.fn()
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	test('renders with correct title and controls', () => {
		render(
			<MemoryRouter>
				<VideoContainer {...mockProps} />
			</MemoryRouter>
		);

		// Check title
		expect(screen.getByText('Test Video.mp4')).toBeInTheDocument();
		
		// Check VideoPlayer is rendered
		const videoPlayer = screen.getByTestId('video-player');
		expect(videoPlayer).toBeInTheDocument();
		expect(videoPlayer).toHaveAttribute('data-video-url', 'gcasp://test-123/');
		
		// Check buttons with full accessible names
		expect(screen.getByRole('button', { name: 'Edit Test Video.mp4' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Delete Test Video.mp4' })).toBeInTheDocument();
	});

	test('passes correct props to VideoPlayer', () => {
		render(
			<MemoryRouter>
				<VideoContainer {...mockProps} />
			</MemoryRouter>
		);

		const videoPlayer = screen.getByTestId('video-player');
		expect(videoPlayer).toHaveAttribute('data-video-url', 'gcasp://test-123/');
		
		// Check options were passed
		const options = JSON.parse(videoPlayer.getAttribute('data-options') || '{}');
		expect(options).toHaveProperty('inactivityTimeout', 2000);
		
		// Check active class
		expect(videoPlayer).not.toHaveClass('active-video');
	});

	test('activates video when clicked', () => {
		render(
			<MemoryRouter>
				<VideoContainer {...mockProps} />
			</MemoryRouter>
		);

		// Click the video display area
		fireEvent.click(screen.getByTestId('video-player'));
		
		// Check onActivate was called
		expect(mockProps.onActivate).toHaveBeenCalledTimes(1);
	});

	test('renders correct active state', () => {
		render(
			<MemoryRouter>
				<VideoContainer {...mockProps} isActive={true} />
			</MemoryRouter>
		);

		// Check active class is applied
		const videoPlayer = screen.getByTestId('video-player');
		expect(videoPlayer).toHaveClass('active-video');
	});

	test('navigates to edit page when Edit button is clicked', () => {
		render(
			<MemoryRouter>
				<VideoContainer {...mockProps} />
			</MemoryRouter>
		);

		// Click edit button using full accessible name
		fireEvent.click(screen.getByRole('button', { name: 'Edit Test Video.mp4' }));
		
		// Check navigation occurred
		expect(mockNavigate).toHaveBeenCalledWith('/edit/Test%20Video.mp4');
	});

	test('shows delete confirmation when Delete button is clicked', () => {
		render(
			<MemoryRouter>
				<VideoContainer {...mockProps} />
			</MemoryRouter>
		);

		// Initially, delete modal should not be visible
		expect(screen.queryByText(/Are you sure you want to delete/)).not.toBeInTheDocument();
		
		// Click header delete button using full accessible name
		fireEvent.click(screen.getByRole('button', { name: 'Delete Test Video.mp4' }));
		
		// Delete confirmation should now be visible
		expect(screen.getByText(/Are you sure you want to delete "Test Video.mp4"\?/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
		
		// Narrow query to modal delete button
		const modal = screen.getByText(/Are you sure you want to delete/).closest('.delete-modal');
		expect(modal).toBeInTheDocument();
		const { getByText } = within(modal);
		const modalDeleteButton = getByText('Delete');
		expect(modalDeleteButton).toBeInTheDocument();
	});

	test('hides delete modal when Cancel is clicked', () => {
		render(
			<MemoryRouter>
				<VideoContainer {...mockProps} />
			</MemoryRouter>
		);

		// Show delete modal
		fireEvent.click(screen.getByRole('button', { name: 'Delete Test Video.mp4' }));
		expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
		
		// Click cancel
		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		
		// Delete modal should no longer be visible
		expect(screen.queryByText(/Are you sure you want to delete/)).not.toBeInTheDocument();
	});

	test('deletes video when confirmation is confirmed', async () => {
		render(
			<MemoryRouter>
				<VideoContainer {...mockProps} />
			</MemoryRouter>
		);

		// Show delete modal
		fireEvent.click(screen.getByRole('button', { name: 'Delete Test Video.mp4' }));
		
		// Narrow query to modal delete button
		const modal = screen.getByText(/Are you sure you want to delete/).closest('.delete-modal');
		const { getByText } = within(modal);
		const modalDeleteButton = getByText('Delete');
		fireEvent.click(modalDeleteButton);
		
		// Wait for async operations
		await waitFor(() => {
			// Check electron API was called
			expect(window.electron.removeSpecificVideo).toHaveBeenCalledWith('Test Video.mp4');
			
			// Check onDelete callback was called
			expect(mockProps.onDelete).toHaveBeenCalledWith('video-123');
			
			// Check modal is closed
			expect(screen.queryByText(/Are you sure you want to delete/)).not.toBeInTheDocument();
		});
	});

	test('handles error in delete operation', async () => {
		// Mock console.error to check for error logging
		const originalConsoleError = console.error;
		console.error = jest.fn();
		
		// Mock electron to return an error
		window.electron.removeSpecificVideo.mockRejectedValueOnce(new Error('Delete failed'));
		
		render(
			<MemoryRouter>
				<VideoContainer {...mockProps} />
			</MemoryRouter>
		);

		// Show delete modal
		fireEvent.click(screen.getByRole('button', { name: 'Delete Test Video.mp4' }));
		
		// Narrow query to modal delete button
		const modal = screen.getByText(/Are you sure you want to delete/).closest('.delete-modal');
		const { getByText } = within(modal);
		const modalDeleteButton = getByText('Delete');
		fireEvent.click(modalDeleteButton);
		
		// Wait for async operations
		await waitFor(() => {
			// Check error was logged
			expect(console.error).toHaveBeenCalledWith(
				'Error deleting video:', 
				expect.any(Error)
			);
			
			// Check modal is closed even with error
			expect(screen.queryByText(/Are you sure you want to delete/)).not.toBeInTheDocument();
		});
		
		// Restore console.error
		console.error = originalConsoleError;
	});

	test('handles failed delete operation', async () => {
		// Mock electron to return failure
		window.electron.removeSpecificVideo.mockResolvedValueOnce({ success: false });
		
		render(
			<MemoryRouter>
				<VideoContainer {...mockProps} />
			</MemoryRouter>
		);

		// Show delete modal
		fireEvent.click(screen.getByRole('button', { name: 'Delete Test Video.mp4' }));
		
		// Narrow query to modal delete button
		const modal = screen.getByText(/Are you sure you want to delete/).closest('.delete-modal');
		const { getByText } = within(modal);
		const modalDeleteButton = getByText('Delete');
		fireEvent.click(modalDeleteButton);
		
		// Wait for async operations
		await waitFor(() => {
			// Check electron API was called
			expect(window.electron.removeSpecificVideo).toHaveBeenCalledWith('Test Video.mp4');
			
			// onDelete should not be called on failure
			expect(mockProps.onDelete).not.toHaveBeenCalled();
			
			// Check modal is closed
			expect(screen.queryByText(/Are you sure you want to delete/)).not.toBeInTheDocument();
		});
	});
});
