import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock the logo import
jest.mock('../../apps/desktop/src/resources/gcasp_testlogo.jpg', () => 'mocked-logo.jpg', { virtual: true });

import Sidebar from '../../apps/desktop/src/components/Sidebar';

describe('Sidebar Component', () => {
	test('renders logo correctly', () => {
		render(
			<MemoryRouter>
				<Sidebar />
			</MemoryRouter>
		);
		
		const logoElement = screen.getByAltText('GCASP Logo');
		expect(logoElement).toBeInTheDocument();
		expect(logoElement).toHaveAttribute('src', 'mocked-logo.jpg');
		
		// Check logo styles
		const style = logoElement.getAttribute('style');
		expect(style).toContain('width: 100%');
		expect(style).toContain('height: auto');
	});
	
	test('renders all navigation links with correct destinations', () => {
		render(
			<MemoryRouter>
				<Sidebar />
			</MemoryRouter>
		);
		
		// Check home link
		const homeLink = screen.getByText('Home').closest('a');
		expect(homeLink).toBeInTheDocument();
		expect(homeLink).toHaveAttribute('href', '/');
		expect(homeLink).toHaveAttribute('aria-label', 'Home');
		
		// Check shared link
		const sharedLink = screen.getByText('Shared').closest('a');
		expect(sharedLink).toBeInTheDocument();
		expect(sharedLink).toHaveAttribute('href', '/shared');
		expect(sharedLink).toHaveAttribute('aria-label', 'Shared Clips');
		
		// Check settings link
		const settingsLink = screen.getByText('Settings').closest('a');
		expect(settingsLink).toBeInTheDocument();
		expect(settingsLink).toHaveAttribute('href', '/settings');
		expect(settingsLink).toHaveAttribute('aria-label', 'Settings');
	});
	
	test('has correct structure (nav -> ul -> li)', () => {
		render(
			<MemoryRouter>
				<Sidebar />
			</MemoryRouter>
		);
		
		// Check that the component has the correct DOM structure
		const navElement = screen.getByRole('navigation');
		expect(navElement).toHaveClass('sidebar');
		
		const ulElement = navElement.querySelector('ul');
		expect(ulElement).toBeInTheDocument();
		
		const liElements = ulElement.querySelectorAll('li');
		expect(liElements.length).toBe(3); // Home, Shared, Settings
		
		// Each li should contain a NavLink (rendered as an anchor)
		liElements.forEach(li => {
			expect(li.querySelector('a')).toBeInTheDocument();
		});
	});
});