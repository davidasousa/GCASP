// jest.config.js
module.exports = {
	// Use jsdom for React component testing
	testEnvironment: 'jsdom',
	
	// Allow longer timeouts for tests involving file operations
	testTimeout: 10000,
	
	// Define where Jest should look for test files
	testMatch: [
		'**/test/**/*.test.js',
		'**/test/**/*.test.jsx'
	],
	
	// Define files to ignore
	testPathIgnorePatterns: [
		'/node_modules/',
		'/.webpack/'
	],
	
	// Transform files with Babel - added explicit options
	transform: {
		'^.+\\.(js|jsx)$': ['babel-jest', {
			presets: ['@babel/preset-env', '@babel/preset-react']
		}]
	},
	
	// Mock static file imports (images, css, etc.)
	moduleNameMapper: {
		'\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/test/__mocks__/fileMock.js',
		'\\.(css|scss)$': '<rootDir>/test/__mocks__/styleMock.js'
	},
	
	// Setup files
	setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
	
	// Directories to search for modules
	moduleDirectories: [
		'node_modules',
		'apps'
	],
	
	// Coverage configuration (optional but useful)
	collectCoverageFrom: [
		'apps/**/*.{js,jsx}',
		'!**/node_modules/**',
		'!**/.webpack/**',
		'!**/dist/**',
		'!**/out/**'
	]
};