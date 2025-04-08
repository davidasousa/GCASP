import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/login-modal.css';

const LoginModal = ({ onClose }) => {
    const navigate = useNavigate();
    
    const handleLoginClick = () => {
        onClose();
        navigate('/login');
    };
    
    return (
        <div className="login-modal-overlay">
            <div className="login-modal">
                <h2>Login Required</h2>
                <p>This feature requires you to be logged in. Would you like to go to the login page?</p>
                <div className="login-modal-buttons">
                    <button 
                        className="cancel-button" 
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button 
                        className="login-button" 
                        onClick={handleLoginClick}
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginModal;