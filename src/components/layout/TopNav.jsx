import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LayoutDashboard, FileText, User, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Shared top navbar + mobile hamburger drawer for all student-facing pages.
 *
 * Props:
 *   subtitle  — small grey text next to "DDS University" (e.g. "Admissions Portal")
 *   rightSlot — optional JSX rendered on the right (e.g. <Badge>Powered by Aria</Badge>)
 *   showUserMenu — true on authenticated pages (shows name + sign-out in desktop + drawer)
 *   name      — student display name
 */
export default function TopNav({ subtitle = 'Admissions Portal', rightSlot, showUserMenu = false, name }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navLinks = showUserMenu ? [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/apply', label: 'Application', icon: FileText },
    { to: '/profile', label: 'My Profile', icon: User },
  ] : [];

  return (
    <>
      {/* ── Top bar ── */}
      <nav className="bg-white border-b border-border px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-40">
        {/* Left — brand */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-navy text-[15px] whitespace-nowrap">DDS University</span>
          <span className="text-gray-300 hidden sm:inline">·</span>
          <span className="text-sm text-gray-500 hidden sm:inline truncate">{subtitle}</span>
        </div>

        {/* Right — desktop */}
        <div className="hidden sm:flex items-center gap-3">
          {rightSlot}
          {showUserMenu && (
            <>
              <Link to="/profile" className="text-sm text-gray-500 max-w-[140px] truncate hover:text-navy transition-colors">{name}</Link>
              <button
                onClick={handleSignOut}
                className="text-sm font-medium text-gray-500 hover:text-red-500 border border-border rounded-lg px-3 py-1.5 transition-colors"
              >
                Sign Out
              </button>
            </>
          )}
        </div>

        {/* Right — mobile: hamburger */}
        <button
          onClick={() => setOpen(true)}
          className="sm:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors text-navy"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </nav>

      {/* ── Mobile Drawer ── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm sm:hidden"
              onClick={() => setOpen(false)}
            />

            {/* Drawer panel */}
            <motion.div
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed top-0 right-0 h-full w-72 max-w-[85vw] bg-white z-50 shadow-2xl flex flex-col sm:hidden"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <p className="font-bold text-navy text-[15px]">DDS University</p>
                  <p className="text-xs text-gray-400">{subtitle}</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Student name chip */}
              {showUserMenu && name && (
                <div className="px-5 py-3 bg-navy/5 border-b border-border">
                  <p className="text-xs text-gray-400 mb-0.5">Signed in as</p>
                  <p className="font-semibold text-navy text-sm truncate">{name}</p>
                </div>
              )}

              {/* Nav links */}
              {navLinks.length > 0 && (
                <div className="px-3 py-4 flex-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">Navigation</p>
                  {navLinks.map(({ to, label, icon: Icon }) => {
                    const active = location.pathname === to;
                    return (
                      <Link
                        key={to}
                        to={to}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl mb-1 transition-colors ${
                          active
                            ? 'bg-navy text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm font-medium">{label}</span>
                        {!active && <ChevronRight className="w-4 h-4 ml-auto text-gray-400" />}
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Right slot for non-auth pages */}
              {!showUserMenu && rightSlot && (
                <div className="px-5 py-4 border-b border-border flex-1 flex items-start">
                  {rightSlot}
                </div>
              )}

              {/* Sign out */}
              {showUserMenu && (
                <div className="px-4 py-4 border-t border-border">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-medium">Sign Out</span>
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
