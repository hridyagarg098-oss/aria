import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

function Spinner() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-7 h-7 border-2 border-navy border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-400 font-medium">Loading…</p>
      </div>
    </div>
  );
}

// Student-only route
export function ProtectedRoute({ children }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  // Still loading auth state
  if (loading) return <Spinner />;

  // Not logged in → go to auth
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;

  // Admin tried to use student portal → redirect
  if (role === 'admin') return <Navigate to="/admin/dashboard" replace />;

  // Role is set (student) or still resolving — render children
  // AuthContext always sets a fallback role, so this won't hang
  return children;
}

// Admin-only route
export function AdminRoute({ children }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/admin" state={{ from: location }} replace />;
  if (role === 'student') return <Navigate to="/dashboard" replace />;
  return children;
}

export default ProtectedRoute;
