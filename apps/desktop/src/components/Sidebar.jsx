import React from 'react';
import { NavLink } from 'react-router-dom';
import logo from '../resources/gcasp-text-logo.png';
import '../styles/index.css';

const Sidebar = () => {
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