import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import './Header.css';

function Header() {
  const location = useLocation();
  const { user, isLoggedIn, isConnected, walletAddress, openLoginModal, disconnect } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { path: '/', label: 'Comprar Boletos', icon: '🎁' },
    { path: '/bingo-live', label: 'Bingo Live', icon: '🎄' },
    { path: '/mis-cartones', label: 'Mis Cartones', icon: '⭐' },
  ];

  return (
    <motion.header
      className="header"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Gradient border effect */}
      <div className="header-border" />

      <div className="container header-content">
        {/* Logo */}
        <Link to="/" className="logo">
          <motion.div
            className="logo-icon"
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.5 }}
          >
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="4" fill="currentColor" />
            </svg>
          </motion.div>
          <div className="logo-text-container">
            <span className="logo-text">Ultra</span>
            <motion.span
              className="logo-highlight"
              animate={{
                textShadow: [
                  '0 0 10px rgba(255, 215, 0, 0.5)',
                  '0 0 20px rgba(255, 215, 0, 0.8)',
                  '0 0 10px rgba(255, 215, 0, 0.5)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Bingo
            </motion.span>
            <span className="christmas-icon">🎄</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="nav desktop-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
            >
              <motion.span
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {item.label}
              </motion.span>
              {isActive(item.path) && (
                <motion.div
                  className="nav-indicator"
                  layoutId="navIndicator"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </Link>
          ))}
        </nav>

        {/* Auth Section */}
        <div className="auth-section">
          {isLoggedIn ? (
            /* Usuario logueado */
            <motion.div
              className="user-logged-in"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="user-info">
                <div className="user-avatar-placeholder">
                  {user.username?.charAt(0).toUpperCase()}
                </div>
                <div className="user-details">
                  <span className="user-name">@{user.username}</span>
                  <span className="wallet-short">
                    {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                  </span>
                </div>
                <div className="user-status-dot" />
              </div>

              <motion.button
                className="btn-disconnect"
                onClick={disconnect}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Desconectar"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </motion.button>
            </motion.div>
          ) : (
            /* Usuario no logueado */
            <motion.button
              className="btn-login"
              onClick={openLoginModal}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="login-icon">👤</span>
              <span>Iniciar Sesion</span>
            </motion.button>
          )}

          {/* Mobile Menu Button */}
          <motion.button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            whileTap={{ scale: 0.9 }}
          >
            <motion.div
              animate={mobileMenuOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
              className="menu-bar"
            />
            <motion.div
              animate={mobileMenuOpen ? { opacity: 0 } : { opacity: 1 }}
              className="menu-bar"
            />
            <motion.div
              animate={mobileMenuOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
              className="menu-bar"
            />
          </motion.button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.nav
            className="mobile-nav"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            {navItems.map((item, index) => (
              <motion.div
                key={item.path}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  to={item.path}
                  className={`mobile-nav-link ${isActive(item.path) ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {isActive(item.path) && (
                    <motion.div
                      className="mobile-nav-indicator"
                      layoutId="mobileNavIndicator"
                    />
                  )}
                </Link>
              </motion.div>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

export default Header;
