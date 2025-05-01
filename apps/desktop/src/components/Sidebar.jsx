import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import logo from '../resources/gcasp-text-logo.png';
import '../styles/index.css';

const Sidebar = () => {
    const { isAuthenticated, isOfflineMode, openLoginModal, logout, currentUser } = useAuth();
    const navigate = useNavigate();

    const handleProtectedLink = (e, requiresAuth, allowOffline) => {
        if (requiresAuth && (!isAuthenticated || (!allowOffline && isOfflineMode))) {
            e.preventDefault();
            openLoginModal();
        }
    };
    
    const handleLoginLogout = () => {
        if (isAuthenticated) {
            // User is logged in, so log them out
            logout();
            navigate('/login');
        } else {
            // User is in offline mode or not authenticated, take them to login
            navigate('/login');
        }
    };

    return (
        <nav className="sidebar">
            <div className="logo">
                <img src={logo} alt="GCASP Logo" style={{ width: '100%', height: 'auto' }} />
            </div>
            {/* Greeting */}
            {isAuthenticated && (
                <div className="sidebar-greeting">
                    Hi {currentUser?.username || 'there'}!
                </div>
            )}
            <div className="sidebar-content">
                <ul className="nav-links">
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
                            to="/profile"
                            className={({ isActive }) => isActive ? 'active' : ''}
                            aria-label="Profile"
                            onClick={(e) => handleProtectedLink(e, true, false)}
                        >
                            Profile
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
                
                <div className="sidebar-footer">
                    <button 
                        className="auth-button"
                        onClick={handleLoginLogout}
                    >
                        {isAuthenticated ? 'Log out' : 'Offline: Log in'}
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default Sidebar;