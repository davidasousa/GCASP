import React from 'react';
import logo from '../resources/gcasp_testlogo.jpg';

const Sidebar = ({ currentView, onChangeView }) => {
	return (
		<nav className="sidebar">
			<div className="logo">
				<img src={logo} alt="GCASP Logo" style={{ width: '100%', height: 'auto' }} />
			</div>
			<ul>
				<li>
					<button
						onClick={() => onChangeView('home')}
						aria-label="Home"
						className={currentView === 'home' ? 'active' : ''}
					>
						Home
					</button>
				</li>
				<li>
					<button
						onClick={() => onChangeView('shared')}
						aria-label="Shared Clips"
						className={currentView === 'shared' ? 'active' : ''}
					>
						Shared
					</button>
				</li>
				<li>
					<button
						onClick={() => onChangeView('settings')}
						aria-label="Settings"
						className={currentView === 'settings' ? 'active' : ''}
					>
						Settings
					</button>
				</li>
			</ul>
		</nav>
	);
};

export default Sidebar;
