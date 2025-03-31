import React, { useEffect } from 'react';
import '../app.css';

const Notification = ({ message, type, visible, onClose }) => {
    useEffect(() => {
        if (visible) {
            const timer = setTimeout(() => {
                onClose();
            }, 2000); // Hide after 2 seconds
            
            return () => clearTimeout(timer);
        }
    }, [visible, onClose]);
    
    if (!visible) return null;
    
    return (
        <div className={`notification ${type}`}>
            {message}
        </div>
    );
};

export default Notification;