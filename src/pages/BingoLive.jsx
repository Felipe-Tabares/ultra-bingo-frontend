import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { BingoCard, NumberBall, GameModeSelector, WinnersHistory, UsersHistory } from '../components/bingo';
import { AnimatedBackground, GlassCard } from '../components/ui';
import { config } from '../config';
import './BingoLive.css';

// All possible bingo numbers organized by column
const ALL_NUMBERS = {
  B: Array.from({ length: 15 }, (_, i) => i + 1),
  I: Array.from({ length: 15 }, (_, i) => i + 16),
  N: Array.from({ length: 15 }, (_, i) => i + 31),
  G: Array.from({ length: 15 }, (_, i) => i + 46),
  O: Array.from({ length: 15 }, (_, i) => i + 61),
};

// Christmas Winter themed column colors (matching snowballs)
const COLUMN_COLORS = {
  B: '#c41e3a',  // Christmas red
  I: '#4fc3f7',  // Ice blue
  N: '#e0e0e0',  // Snow white/silver
  G: '#228b22',  // Christmas green
  O: '#ffd700',  // Gold
};

function BingoLive() {
  const {
    gameState,
    isConnected,
    joinGame,
    leaveGame,
    startGame,
    pauseGame,
    resumeGame,
    endGame,
    clearGame,
    callNumber,
    verifyWinner,
    rejectWinner,
    setGameMode,
    reconnectWithAuth,
  } = useSocket();
  const { user, isLoggedIn, isAdmin } = useAuth();
  const [myCards, setMyCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [searchedCard, setSearchedCard] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showWinnerBanner, setShowWinnerBanner] = useState(false);

  // Track if we've already reconnected for admin
  const hasReconnectedForAdminRef = useRef(false);

  // Track if we've joined the game room
  const hasJoinedGameRef = useRef(false);

  // Keep refs to avoid stale closures in callbacks
  const calledNumbersRef = useRef([]);
  const gameStatusRef = useRef('waiting');
  const isAdminRef = useRef(false);

  // Update refs on each render (but don't cause re-renders)
  calledNumbersRef.current = gameState?.calledNumbers || [];
  gameStatusRef.current = gameState?.status || 'waiting';
  isAdminRef.current = isAdmin;

  // Reconnect socket with auth when user becomes admin (only once)
  useEffect(() => {
    if (isLoggedIn && isAdmin && isConnected && !hasReconnectedForAdminRef.current) {
      // Only reconnect if we're already connected but need admin privileges
      const savedUser = localStorage.getItem('ultra-bingo-user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        // Check if socket doesn't have admin auth yet
        if (parsedUser.isAdmin) {
          hasReconnectedForAdminRef.current = true;
          reconnectWithAuth();
        }
      }
    }
  }, [isAdmin, isLoggedIn, isConnected, reconnectWithAuth]);

  // Handle admin calling a number - CRITICAL: Use refs to avoid stale closures
  // and prevent re-creating this function on every state change
  const handleCallNumber = useCallback((number) => {
    // Use refs to get current values without dependencies
    if (isAdminRef.current && gameStatusRef.current === 'playing') {
      if (!calledNumbersRef.current.includes(number)) {
        callNumber(number);
      }
    }
  }, [callNumber]); // Only depend on callNumber which is stable

  // Join game room on mount - use refs to prevent re-running on every render
  useEffect(() => {
    if (!hasJoinedGameRef.current) {
      hasJoinedGameRef.current = true;
      joinGame('main');
    }

    return () => {
      if (hasJoinedGameRef.current) {
        leaveGame('main');
        hasJoinedGameRef.current = false;
      }
    };
  }, []); // Empty deps - only run on mount/unmount

  // Fetch user's cards
  useEffect(() => {
    async function fetchMyCards() {
      if (!user?.token) {
        setLoadingCards(false);
        return;
      }

      try {
        const response = await fetch(`${config.apiUrl}/api/cards/my-cards`, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
        if (!response.ok) throw new Error('Error fetching cards');
        const data = await response.json();
        setMyCards(data.cards || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingCards(false);
      }
    }

    fetchMyCards();
  }, [user]);

  const {
    status = 'waiting',
    calledNumbers = [],
    currentNumber = null,
    winner = null,
    potentialWinners = [],
    gameMode = 'fullCard',
    showContinueMessage = false,
  } = gameState || {};

  // Track previous status to detect when game ends with a winner (real-time announcement)
  const prevStatusRef = useRef(status);
  useEffect(() => {
    // Only show banner when status changes TO 'ended' with a winner (real-time event)
    // Not when page loads with status already 'ended'
    if (prevStatusRef.current !== 'ended' && status === 'ended' && winner?.cardId) {
      setShowWinnerBanner(true);
    }
    // Hide banner when a new game starts
    if (status === 'playing' || status === 'waiting') {
      setShowWinnerBanner(false);
    }
    prevStatusRef.current = status;
  }, [status, winner]);

  // Search for a card by ID
  const handleCardSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!cardSearchQuery.trim() || !user?.token) return;

    setSearchLoading(true);
    setSearchError('');
    setSearchedCard(null);

    try {
      const response = await fetch(
        `${config.apiUrl}/api/admin/cards/search?cardId=${encodeURIComponent(cardSearchQuery.trim())}`,
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Cartón no encontrado');
      }

      const data = await response.json();
      setSearchedCard(data);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearchLoading(false);
    }
  }, [cardSearchQuery, user?.token]);

  // Handle game mode change (via API for persistence)
  const handleModeChange = useCallback(async (newMode) => {
    if (!user?.token) return;

    const response = await fetch(`${config.apiUrl}/api/admin/game/mode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({ mode: newMode }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error cambiando modo');
    }

    // Also emit socket event for real-time sync
    setGameMode(newMode);
  }, [user?.token, setGameMode]);

  return (
    <div className="bingo-live">
      <AnimatedBackground />

      <div className="container bingo-live-content">
        {/* Connection Status */}
        <motion.div
          className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <motion.span
            className="status-dot"
            animate={isConnected ? {
              scale: [1, 1.2, 1],
              boxShadow: ['0 0 0 0 rgba(0, 255, 136, 0.4)', '0 0 0 8px rgba(0, 255, 136, 0)', '0 0 0 0 rgba(0, 255, 136, 0.4)']
            } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          />
          {isConnected ? 'En vivo' : 'Desconectado'}
        </motion.div>

        {/* "Continua el juego" Message - Shows when winner is rejected */}
        <AnimatePresence>
          {showContinueMessage && (
            <motion.div
              className="continue-game-banner"
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <span className="continue-icon">▶</span>
              <span>¡Continúa el juego!</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Official BINGO Winner Banner - Only shows in real-time when winner is announced */}
        <AnimatePresence>
          {showWinnerBanner && winner && winner.cardId && (
            <motion.div
              className="winner-banner-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="winner-banner"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              >
                <button
                  className="winner-banner-close"
                  onClick={() => setShowWinnerBanner(false)}
                  aria-label="Cerrar"
                >
                  ✕
                </button>
                <motion.div
                  className="winner-banner-icon"
                  animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                >
                  🎉
                </motion.div>
                <h2>¡BINGO!</h2>
                <p className="winner-name">
                  Ganador: <strong>@{winner.odUsername || 'Anónimo'}</strong>
                </p>
                <p className="winner-wallet">
                  {winner.wallet ? `${winner.wallet.slice(0, 6)}...${winner.wallet.slice(-4)}` : ''}
                </p>
                <p className="winner-pattern">
                  Patrón: <strong>{winner.patternName || winner.pattern || gameMode}</strong>
                </p>
                <p className="winner-card-id">
                  Cartón: #{winner.cardId?.slice(-8) || ''}
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Mode Selector - visible to everyone, editable by admin only when game not active */}
        <motion.section
          className="game-mode-section"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <GameModeSelector
            isAdmin={isAdmin}
            currentMode={gameMode}
            gameStatus={status}
            onModeChange={handleModeChange}
          />
        </motion.section>

        {/* Admin Controls Panel */}
        {isAdmin && (
          <motion.section
            className="admin-controls-section"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <GlassCard className="admin-controls-card" glow>
              <div className="admin-badge">
                <span className="admin-icon">👑</span>
                <span>Panel de Administrador</span>
              </div>

              {/* Potential Winners Panel - Sidebar Style */}
              <AnimatePresence>
                {potentialWinners.length > 0 && (status === 'playing' || status === 'paused') && (
                  <motion.div
                    className="potential-winners-sidebar"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 50 }}
                  >
                    <div className="sidebar-header">
                      <motion.span
                        className="sidebar-icon"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        🏆
                      </motion.span>
                      <span>Potencial Ganador</span>
                      <span className="paused-badge">JUEGO PAUSADO</span>
                    </div>

                    {potentialWinners.map((potentialWinner) => (
                      <div key={potentialWinner.cardId} className="potential-winner-card">
                        <div className="pw-info">
                          <h4>@{potentialWinner.username || 'Anónimo'}</h4>
                          <p className="pw-card-id">ID: {potentialWinner.cardId}</p>
                          <p className="pw-pattern">Patrón: <strong>{potentialWinner.pattern}</strong></p>
                          <p className="pw-wallet">{potentialWinner.wallet?.slice(0, 10)}...</p>
                        </div>

                        {/* Show card preview if available */}
                        {potentialWinner.cardNumbers && (
                          <div className="pw-card-preview">
                            <BingoCard
                              card={{ id: potentialWinner.cardId, numbers: potentialWinner.cardNumbers }}
                              calledNumbers={calledNumbers}
                              size="small"
                            />
                          </div>
                        )}

                        <div className="pw-actions">
                          <motion.button
                            className="pw-btn pw-accept"
                            onClick={() => verifyWinner(potentialWinner.cardId)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            ✓ Aceptar Ganador
                          </motion.button>
                          <motion.button
                            className="pw-btn pw-reject"
                            onClick={() => rejectWinner(potentialWinner.cardId)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            ✗ Rechazar
                          </motion.button>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Card Search Section */}
              <div className="admin-card-search">
                <h4>Buscar Cartón por ID</h4>
                <form onSubmit={handleCardSearch} className="search-form">
                  <input
                    type="text"
                    value={cardSearchQuery}
                    onChange={(e) => setCardSearchQuery(e.target.value)}
                    placeholder="card_xxxxxxxx-xxxx-xxxx..."
                    className="search-input"
                  />
                  <motion.button
                    type="submit"
                    className="search-btn"
                    disabled={searchLoading}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {searchLoading ? '...' : '🔍'}
                  </motion.button>
                </form>

                {searchError && (
                  <p className="search-error">{searchError}</p>
                )}

                {/* Search Result */}
                {searchedCard && (
                  <div className="search-result">
                    <div className="search-result-header">
                      <h5>Cartón Encontrado</h5>
                      <button
                        className="close-search"
                        onClick={() => setSearchedCard(null)}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="search-result-content">
                      <div className="search-result-card">
                        <BingoCard
                          card={searchedCard.card}
                          calledNumbers={searchedCard.calledNumbers || calledNumbers}
                          size="small"
                        />
                      </div>
                      <div className="search-result-info">
                        <p><strong>Dueño:</strong> @{searchedCard.card.ownerUsername || 'Anónimo'}</p>
                        <p><strong>Wallet:</strong> {searchedCard.card.ownerWallet?.slice(0, 12)}...</p>
                        <p><strong>Progreso:</strong> {searchedCard.progress?.completed}/{searchedCard.progress?.total} ({searchedCard.progress?.percentage}%)</p>
                        <p><strong>Modo:</strong> {searchedCard.gameMode}</p>
                        {searchedCard.isWinner && (
                          <p className="search-winner-badge">¡ES GANADOR! ({searchedCard.winnerPattern})</p>
                        )}
                      </div>
                    </div>
                    {searchedCard.isWinner && status === 'playing' && (
                      <motion.button
                        className="verify-search-result-btn"
                        onClick={() => verifyWinner(searchedCard.card.id)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Verificar y Declarar Ganador
                      </motion.button>
                    )}
                  </div>
                )}
              </div>

              <div className="admin-buttons">
                {status === 'waiting' && (
                  <motion.button
                    className="admin-btn start-btn"
                    onClick={startGame}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Iniciar Juego
                  </motion.button>
                )}
                {status === 'playing' && (
                  <>
                    <motion.button
                      className="admin-btn pause-btn"
                      onClick={pauseGame}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                      Pausar
                    </motion.button>
                    <motion.button
                      className="admin-btn end-btn"
                      onClick={() => endGame()}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                      Terminar
                    </motion.button>
                  </>
                )}
                {status === 'paused' && (
                  <>
                    <motion.button
                      className="admin-btn resume-btn"
                      onClick={resumeGame}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Reanudar
                    </motion.button>
                    <motion.button
                      className="admin-btn end-btn"
                      onClick={() => endGame()}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                      </svg>
                      Terminar
                    </motion.button>
                  </>
                )}
                {status === 'ended' && (
                  <>
                    <motion.button
                      className="admin-btn clear-btn"
                      onClick={clearGame}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                      </svg>
                      Limpiar Juego
                    </motion.button>
                    <motion.button
                      className="admin-btn start-btn"
                      onClick={startGame}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                      </svg>
                      Nuevo Juego
                    </motion.button>
                  </>
                )}
              </div>
              {status === 'playing' && potentialWinners.length === 0 && (
                <p className="admin-hint">
                  Haz clic en cualquier número del tablero para cantarlo
                </p>
              )}
            </GlassCard>
          </motion.section>
        )}

        {/* Current Number Display */}
        <section className="current-number-section">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Número Actual
          </motion.h2>

          <AnimatePresence mode="wait">
            {status === 'waiting' ? (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <GlassCard className="status-card waiting">
                  <motion.div
                    className="status-icon"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  </motion.div>
                  <h3>El bingo aún no ha comenzado</h3>
                  <p>Espera a que el administrador inicie el juego</p>
                </GlassCard>
              </motion.div>
            ) : status === 'paused' ? (
              <motion.div
                key="paused"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <GlassCard className="status-card paused">
                  <motion.div
                    className="status-icon"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  </motion.div>
                  <h3>Juego en pausa</h3>
                </GlassCard>
              </motion.div>
            ) : status === 'ended' ? (
              <motion.div
                key="ended"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <GlassCard className="status-card ended" glow>
                  <motion.div
                    className="winner-celebration"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.5 }}
                  >
                    🎉
                  </motion.div>
                  <h3>¡Juego Terminado!</h3>
                  {winner && (
                    <p className="winner-name">
                      Ganador: <span>@{winner.odUsername || winner.username || winner.wallet?.slice(0, 10)}</span>
                    </p>
                  )}
                </GlassCard>
              </motion.div>
            ) : currentNumber ? (
              <motion.div
                key={currentNumber}
                className="current-number-display"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <NumberBall number={currentNumber} size="huge" animate current />
              </motion.div>
            ) : (
              <motion.div
                key="waiting-number"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <GlassCard className="status-card">
                  <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <p>Esperando el primer número...</p>
                  </motion.div>
                </GlassCard>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Called Numbers Board */}
        <section className="called-numbers-section">
          <motion.div
            className="section-header"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2>
              <span className="section-icon">🎄</span>
              Números Cantados
            </h2>
            <div className="numbers-count">
              <motion.span
                key={calledNumbers.length}
                initial={{ scale: 1.5, color: '#ffd700' }}
                animate={{ scale: 1, color: '#fff' }}
              >
                {calledNumbers.length}
              </motion.span>
              <span>/75</span>
            </div>
          </motion.div>

          <GlassCard className="numbers-board-card">
            <div className="numbers-board">
              {Object.entries(ALL_NUMBERS).map(([letter, numbers], colIndex) => (
                <motion.div
                  key={letter}
                  className="numbers-column"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + colIndex * 0.1 }}
                >
                  <div
                    className="column-header"
                    style={{
                      background: `linear-gradient(135deg, ${COLUMN_COLORS[letter]} 0%, ${COLUMN_COLORS[letter]}80 100%)`,
                      boxShadow: `0 4px 20px ${COLUMN_COLORS[letter]}40`,
                    }}
                  >
                    {letter}
                  </div>
                  <div className="column-numbers">
                    {numbers.map((num) => {
                      const isCalled = calledNumbers.includes(num);
                      const isCurrent = num === currentNumber;
                      const isClickable = isAdmin && status === 'playing' && !isCalled;
                      return (
                        <motion.div
                          key={num}
                          className={`number-cell ${isCalled ? 'called' : ''} ${isCurrent ? 'current' : ''} ${isClickable ? 'clickable' : ''}`}
                          initial={false}
                          animate={isCalled ? {
                            backgroundColor: `${COLUMN_COLORS[letter]}40`,
                            color: '#fff',
                            scale: isCurrent ? [1, 1.1, 1] : 1,
                          } : {
                            backgroundColor: 'rgba(10, 10, 20, 0.6)',
                            color: 'rgba(255, 255, 255, 0.3)',
                          }}
                          transition={{ duration: 0.3 }}
                          style={isCurrent ? {
                            boxShadow: `0 0 20px ${COLUMN_COLORS[letter]}`,
                            border: `2px solid ${COLUMN_COLORS[letter]}`,
                          } : {}}
                          onClick={isClickable ? () => handleCallNumber(num) : undefined}
                          whileHover={isClickable ? {
                            scale: 1.15,
                            backgroundColor: `${COLUMN_COLORS[letter]}60`,
                            color: '#fff',
                          } : {}}
                          whileTap={isClickable ? { scale: 0.95 } : {}}
                        >
                          {num}
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </section>

        {/* My Cards */}
        {isLoggedIn && (
          <motion.section
            className="my-cards-section"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="section-header">
              <h2>
                <span className="section-icon">🎁</span>
                Mis Cartones
              </h2>
              {myCards.length > 0 && (
                <span className="cards-count">{myCards.length} cartón{myCards.length > 1 ? 'es' : ''}</span>
              )}
            </div>

            {loadingCards ? (
              <GlassCard className="loading-state">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="loading-spinner"
                >
                  ⏳
                </motion.div>
                <p>Cargando tus cartones...</p>
              </GlassCard>
            ) : myCards.length === 0 ? (
              <GlassCard className="no-cards-message">
                <div className="no-cards-icon">🎄</div>
                <p>No tienes cartones para este bingo</p>
                <motion.a
                  href="/"
                  className="buy-cards-btn"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Comprar Cartones
                </motion.a>
              </GlassCard>
            ) : (
              <div className="my-cards-grid">
                <AnimatePresence>
                  {myCards.map((card, index) => (
                    <BingoCard
                      key={card.id}
                      card={card}
                      calledNumbers={calledNumbers}
                      size="normal"
                      index={index}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.section>
        )}

        {/* Winners History - Visible to everyone */}
        <motion.section
          className="winners-history-section"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <WinnersHistory />
        </motion.section>

        {/* Users History - Admin Only */}
        {isAdmin && user?.token && (
          <motion.section
            className="users-history-section"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
          >
            <UsersHistory token={user.token} />
          </motion.section>
        )}

        {/* Recent Numbers Panel */}
        <AnimatePresence>
          {calledNumbers.length > 0 && (
            <motion.div
              className="recent-numbers"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <div className="recent-numbers-header">
                <h3>Últimos números</h3>
                <span className="live-badge">
                  <motion.span
                    className="live-dot"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  EN VIVO
                </span>
              </div>
              <div className="recent-numbers-list">
                {calledNumbers.slice(-5).reverse().map((num, index) => (
                  <NumberBall
                    key={num}
                    number={num}
                    size={index === 0 ? 'large' : 'small'}
                    animate={index === 0}
                    index={index}
                    current={index === 0}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default BingoLive;
