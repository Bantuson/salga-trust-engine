import { useState, useEffect, useRef } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Button } from '@shared/components/ui/Button';
import { useReducedMotion } from '@shared/hooks/useReducedMotion';
import { useAuth } from '../../hooks/useAuth';

export function PublicHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const prefersReducedMotion = useReducedMotion();
  const { user, signOut } = useAuth();

  // Click-outside handler for user dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isUserMenuOpen && !(e.target as Element)?.closest('.header-user-menu-wrapper')) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isUserMenuOpen]);

  // Hide-on-scroll behavior
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Always show header at top of page
      if (currentScrollY < 80) {
        setIsHeaderVisible(true);
      }
      // Hide when scrolling down
      else if (currentScrollY > lastScrollY.current && currentScrollY > 80) {
        setIsHeaderVisible(false);
      }
      // Show when scrolling up
      else if (currentScrollY < lastScrollY.current) {
        setIsHeaderVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/about', label: 'About' },
    { to: '/profile', label: 'Profile' },
  ];

  return (
    <>
      <header
        className={`public-header ${prefersReducedMotion ? 'no-motion' : ''} ${!isHeaderVisible ? 'public-header--hidden' : ''}`}
      >
        <div className="header-container">
          {/* Logo */}
          <Link to="/" className="header-logo">
            <span className="logo-text">SALGA Trust Engine</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="header-nav desktop-nav">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Desktop CTA / User Menu */}
          {user ? (
            <div className="header-user-menu-wrapper desktop-cta">
              <button
                className="header-user-button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              >
                <div className="user-avatar">
                  {(user.user_metadata?.full_name || user.email || 'U').charAt(0).toUpperCase()}
                </div>
                <span className="user-name">
                  {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Citizen'}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isUserMenuOpen && (
                <div className="header-user-dropdown">
                  <Link to="/profile" className="dropdown-item" onClick={() => setIsUserMenuOpen(false)}>
                    Profile
                  </Link>
                  <Link to="/report" className="dropdown-item" onClick={() => setIsUserMenuOpen(false)}>
                    Report Issue
                  </Link>
                  <hr className="dropdown-divider" />
                  <button
                    className="dropdown-item dropdown-signout"
                    onClick={() => { signOut(); setIsUserMenuOpen(false); }}
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="header-cta desktop-cta">
              <Link to="/report">
                <Button variant="primary" size="md">
                  Report Issue
                </Button>
              </Link>
            </div>
          )}

          {/* Mobile Hamburger */}
          <button
            className="hamburger-button"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay">
          <div className="mobile-menu-content">
            {/* Close Button */}
            <button
              className="mobile-menu-close"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Mobile User Identity (if authenticated) */}
            {user && (
              <div className="mobile-user-identity">
                <div className="user-avatar">
                  {(user.user_metadata?.full_name || user.email || 'U').charAt(0).toUpperCase()}
                </div>
                <span className="mobile-user-name">
                  {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Citizen'}
                </span>
              </div>
            )}

            {/* Mobile Nav Links */}
            <nav className="mobile-nav">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </NavLink>
              ))}

              {/* Auth-specific links (if authenticated) */}
              {user && (
                <>
                  <NavLink
                    to="/profile"
                    className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Profile
                  </NavLink>
                  <hr className="mobile-nav-divider" />
                  <button
                    className="mobile-nav-link mobile-signout"
                    onClick={() => { signOut(); setIsMobileMenuOpen(false); }}
                  >
                    Sign Out
                  </button>
                </>
              )}
            </nav>

            {/* Mobile CTA (only when unauthenticated) */}
            {!user && (
              <div className="mobile-cta">
                <Link to="/report" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button variant="primary" size="lg">
                    Report Issue
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
