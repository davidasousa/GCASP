import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import logo from '../resources/gcasp-text-logo.png';
import '../styles/index.css';

const Sidebar = () => {
    // Use openLoginModal instead of showLoginPrompt
    const { isAuthenticated, isOfflineMode, openLoginModal } = useAuth();

    const handleProtectedLink = (e, requiresAuth, allowOffline) => {
        if (requiresAuth && (!isAuthenticated || (!allowOffline && isOfflineMode))) {
            e.preventDefault();
            // Open the modal instead of navigating to login page
            openLoginModal();
        }
    };

    return (
        <nav className="sidebar">
            <div className="logo">
                <img src={logo} alt="GCASP Logo" style={{ width: '100%', height: 'auto' }} />
            </div>
            <ul>
                <li>
                    <NavLink 
                        to="/"
                        className={({ isActive }) => isActive ? 'active' : ''}
                        aria-label="Home"
                    >
                        Home
                    </NavLink>
                </li>
                <li>
                    <NavLink 
                        to="/shared"
                        className={({ isActive }) => isActive ? 'active' : ''}
                        aria-label="Shared Clips"
                        onClick={(e) => handleProtectedLink(e, true, false)}
                    >
                        Shared
                    </NavLink>
                </li>
                <li>
                    <NavLink 
                        to="/settings"
                        className={({ isActive }) => isActive ? 'active' : ''}
                        aria-label="Settings"
                    >
                        Settings
                    </NavLink>
                </li>
            </ul>
        </nav>
    );
};

export default Sidebar;