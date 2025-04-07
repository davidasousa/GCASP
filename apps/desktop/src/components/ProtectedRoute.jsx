import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requiresAuth = true, allowOffline = false }) => {
	const { isAuthenticated, isOfflineMode, loading } = useAuth();
	const location = useLocation();
	
	// Show loading state
	if (loading) {
		return (
			<div className="auth-loading">
				<div className="loading-spinner"></div>
				<p>Loading...</p>
			</div>
		);
	}
	
	// Determine if user has access
	const hasAccess = (
		(requiresAuth && isAuthenticated) || // Authenticated routes 
		(!requiresAuth) || // Public routes
		(requiresAuth && allowOffline && isOfflineMode) // Routes allowed in offline mode
	);
	
	// Redirect to login if not authenticated
	if (!hasAccess) {
		return <Navigate to="/login" state={{ from: location }} replace />;
	}
	
	// If access is granted, render the children
	return children;
};

export default ProtectedRoute;