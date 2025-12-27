import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import GlowButton from './GlowButton';
import './LoginModal.css';

function LoginModal() {
  const {
    showLoginModal,
    closeLoginModal,
    isConnected,
    walletAddress,
    connectWallet,
    completeLogin,
  } = useAuth();

  const [username, setUsername] = useState('');
  const [step, setStep] = useState(1); // 1: username, 2: wallet
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUsernameSubmit = (e) => {
    e.preventDefault();
    setError('');

    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      setError('Por favor ingresa tu nombre de usuario');
      return;
    }

    if (trimmedUsername.length < 3) {
      setError('El nombre debe tener al menos 3 caracteres');
      return;
    }

    if (trimmedUsername.length > 30) {
      setError('El nombre no puede tener más de 30 caracteres');
      return;
    }

    // SECURITY: Only allow safe characters (alphanumeric, underscore, hyphen)
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      setError('Solo se permiten letras, números, guiones y guiones bajos');
      return;
    }

    setStep(2);
  };

  const handleConnectWallet = async (type) => {
    setError('');
    setLoading(true);
    try {
      await connectWallet(type);
    } catch (err) {
      setError('Error conectando wallet');
    }
    setLoading(false);
  };

  const handleCompleteLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await completeLogin(username);
    } catch (err) {
      setError('Error completando el registro');
    }
    setLoading(false);
  };

  const handleClose = () => {
    setUsername('');
    setStep(1);
    setError('');
    closeLoginModal();
  };

  const handleBack = () => {
    setStep(1);
    setError('');
  };

  return (
    <AnimatePresence>
      {showLoginModal && (
        <>
          {/* Backdrop */}
          <motion.div
            className="login-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            className="login-modal"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Close button */}
            <button className="modal-close" onClick={handleClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="modal-header">
              <motion.div
                className="modal-icon"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                {step === 1 ? '👤' : '🔗'}
              </motion.div>
              <h2>{step === 1 ? 'Bienvenido a UltraBingo' : 'Conecta tu Wallet'}</h2>
              <p>
                {step === 1
                  ? 'Ingresa tu nombre de usuario para comenzar'
                  : 'Conecta tu wallet para completar el registro'}
              </p>
            </div>

            {/* Progress indicator */}
            <div className="login-progress">
              <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
                <span className="step-number">1</span>
                <span className="step-label">Usuario</span>
              </div>
              <div className="progress-line">
                <motion.div
                  className="progress-fill"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: step >= 2 ? 1 : 0 }}
                />
              </div>
              <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
                <span className="step-number">2</span>
                <span className="step-label">Wallet</span>
              </div>
            </div>

            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  className="login-error"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step 1: Username */}
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.form
                  key="step1"
                  className="login-form"
                  onSubmit={handleUsernameSubmit}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <div className="form-group">
                    <label htmlFor="username">Nombre de usuario</label>
                    <div className="input-wrapper">
                      <span className="input-prefix">@</span>
                      <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="tu_usuario"
                        autoComplete="off"
                        autoFocus
                      />
                    </div>
                    <span className="input-hint">
                      Usa tu nombre de Telegram, Twitter o Twitch
                    </span>
                  </div>

                  <GlowButton type="submit" size="lg" className="full-width">
                    Continuar
                  </GlowButton>
                </motion.form>
              )}

              {/* Step 2: Connect Wallet */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  className="wallet-options"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <div className="username-preview">
                    <span className="preview-label">Usuario:</span>
                    <span className="preview-value">@{username}</span>
                    <button type="button" className="edit-btn" onClick={handleBack}>
                      Editar
                    </button>
                  </div>

                  {!isConnected ? (
                    <div className="wallet-buttons">
                      <button
                        className="wallet-option"
                        onClick={() => handleConnectWallet('injected')}
                        disabled={loading}
                      >
                        <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" alt="MetaMask" />
                        <span>MetaMask</span>
                      </button>

                      <button
                        className="wallet-option"
                        onClick={() => handleConnectWallet('coinbase')}
                        disabled={loading}
                      >
                        <svg viewBox="0 0 32 32" fill="#0052FF">
                          <circle cx="16" cy="16" r="16" fill="#0052FF"/>
                          <path d="M16 6C10.48 6 6 10.48 6 16s4.48 10 10 10 10-4.48 10-10S21.52 6 16 6zm0 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" fill="white"/>
                        </svg>
                        <span>Coinbase Wallet</span>
                      </button>

                      <button
                        className="wallet-option"
                        onClick={() => handleConnectWallet('walletconnect')}
                        disabled={loading}
                      >
                        <svg viewBox="0 0 32 32" fill="none">
                          <rect width="32" height="32" rx="6" fill="#3B99FC"/>
                          <path d="M10.5 12.5c3-3 8-3 11 0l.4.4c.1.1.1.3 0 .5l-1.3 1.3c-.1.1-.2.1-.3 0l-.5-.5c-2.1-2.1-5.5-2.1-7.6 0l-.6.6c-.1.1-.2.1-.3 0l-1.3-1.3c-.1-.1-.1-.3 0-.5l.5-.5zm13.6 2.5l1.2 1.2c.1.1.1.3 0 .5l-5.4 5.4c-.2.2-.4.2-.6 0l-3.8-3.8c0-.1-.1-.1-.1 0l-3.8 3.8c-.2.2-.4.2-.6 0l-5.4-5.4c-.1-.1-.1-.3 0-.5l1.2-1.2c.2-.2.4-.2.6 0l3.8 3.8c0 .1.1.1.1 0l3.8-3.8c.2-.2.4-.2.6 0l3.8 3.8c0 .1.1.1.1 0l3.8-3.8c.2-.2.5-.2.7 0z" fill="white"/>
                        </svg>
                        <span>WalletConnect</span>
                      </button>
                    </div>
                  ) : (
                    <div className="wallet-connected-preview">
                      <div className="connected-info">
                        <span className="connected-icon">✓</span>
                        <div className="connected-details">
                          <span className="connected-label">Wallet conectada</span>
                          <span className="connected-address">
                            {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                          </span>
                        </div>
                      </div>

                      <GlowButton
                        onClick={handleCompleteLogin}
                        size="lg"
                        className="full-width"
                        loading={loading}
                      >
                        Completar Registro
                      </GlowButton>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default LoginModal;
