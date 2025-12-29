import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { NumberBall, BingoCard } from '../components/bingo';
import { config } from '../config';
import './Admin.css';

// All possible bingo numbers
const ALL_NUMBERS = Array.from({ length: 75 }, (_, i) => i + 1);

function Admin() {
  const navigate = useNavigate();
  const { address, isConnected: walletConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState({
    status: 'waiting',
    calledNumbers: [],
    currentNumber: null,
  });
  const [availableNumbers, setAvailableNumbers] = useState(ALL_NUMBERS);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Card Search State
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  // Loading states for game controls
  const [controlsLoading, setControlsLoading] = useState({
    start: false,
    pause: false,
    resume: false,
    end: false,
    callNumber: false,
  });

  // Check if admin session exists
  useEffect(() => {
    const adminToken = localStorage.getItem('admin-token');
    if (adminToken) {
      validateToken(adminToken);
    }
  }, []);

  // Handle WebSocket messages
  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      const { type, payload } = data;

      switch (type) {
        case 'game-state':
          setGameState(payload);
          updateAvailableNumbers(payload.calledNumbers || []);
          break;

        case 'number-called':
          setGameState((prev) => ({
            ...prev,
            currentNumber: payload.number,
            calledNumbers: [...(prev.calledNumbers || []), payload.number],
          }));
          setAvailableNumbers((prev) => prev.filter((n) => n !== payload.number));
          break;

        case 'game-started':
          setGameState((prev) => ({
            ...prev,
            status: 'playing',
            calledNumbers: [],
            currentNumber: null,
          }));
          setAvailableNumbers(ALL_NUMBERS);
          break;

        case 'game-paused':
          setGameState((prev) => ({ ...prev, status: 'paused' }));
          break;

        case 'game-resumed':
          setGameState((prev) => ({ ...prev, status: 'playing' }));
          break;

        case 'game-ended':
          setGameState((prev) => ({ ...prev, status: 'ended' }));
          break;

        case 'game-cleared':
          setGameState({
            status: 'waiting',
            calledNumbers: [],
            currentNumber: null,
          });
          setAvailableNumbers(ALL_NUMBERS);
          break;

        default:
          console.log('Unknown message type:', type);
      }
    } catch (e) {
      console.error('Error parsing WebSocket message:', e);
    }
  }, []);

  // Create WebSocket connection
  const createConnection = useCallback(() => {
    const adminToken = localStorage.getItem('admin-token');
    if (!adminToken) return null;

    let wsUrl = config.wsUrl;
    wsUrl += `?token=${encodeURIComponent(adminToken)}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Admin WebSocket connected');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;

      // Join default game room
      ws.send(JSON.stringify({
        action: 'join-game',
        gameId: 'default'
      }));
    };

    ws.onclose = (event) => {
      console.log('Admin WebSocket disconnected:', event.code);
      setIsConnected(false);

      // Attempt to reconnect
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => {
          createConnection();
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error('Admin WebSocket error:', error);
    };

    ws.onmessage = handleMessage;

    setSocket(ws);
    return ws;
  }, [handleMessage]);

  // Connect to WebSocket when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const ws = createConnection();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectAttemptsRef.current = maxReconnectAttempts;
      if (ws) {
        ws.close();
      }
    };
  }, [isAuthenticated, createConnection]);

  // Helper to send WebSocket messages
  const sendMessage = useCallback((action, payload = {}) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action, ...payload }));
    } else {
      console.warn('WebSocket not connected');
    }
  }, [socket]);

  const validateToken = async (token) => {
    try {
      const response = await fetch(`${config.apiUrl}/api/admin/validate`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('admin-token');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // SECURITY: Connect wallet for admin login
  const handleConnectWallet = async () => {
    try {
      await connect({ connector: injected() });
    } catch (err) {
      setError('Error conectando wallet');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    // SECURITY: Wallet is required for admin login
    if (!walletConnected || !address) {
      setError('Debes conectar tu wallet primero');
      return;
    }

    try {
      const response = await fetch(`${config.apiUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          wallet: address, // CRITICAL: Send wallet for JWT token
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Credenciales incorrectas');
      }

      const data = await response.json();
      localStorage.setItem('admin-token', data.token);
      setIsAuthenticated(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin-token');
    setIsAuthenticated(false);
    if (socket) {
      socket.close();
    }
    setSocket(null);
    navigate('/');
  };

  const updateAvailableNumbers = (called) => {
    setAvailableNumbers(ALL_NUMBERS.filter((n) => !called.includes(n)));
  };

  // Game controls with loading feedback
  const startGame = useCallback(() => {
    if (!controlsLoading.start) {
      setControlsLoading((prev) => ({ ...prev, start: true }));
      sendMessage('admin-start-game');
      setGameState((prev) => ({ ...prev, status: 'playing', calledNumbers: [], currentNumber: null }));
      setAvailableNumbers(ALL_NUMBERS);
      setTimeout(() => setControlsLoading((prev) => ({ ...prev, start: false })), 500);
    }
  }, [sendMessage, controlsLoading.start]);

  const pauseGame = useCallback(() => {
    if (!controlsLoading.pause) {
      setControlsLoading((prev) => ({ ...prev, pause: true }));
      sendMessage('admin-pause-game');
      setGameState((prev) => ({ ...prev, status: 'paused' }));
      setTimeout(() => setControlsLoading((prev) => ({ ...prev, pause: false })), 500);
    }
  }, [sendMessage, controlsLoading.pause]);

  const resumeGame = useCallback(() => {
    if (!controlsLoading.resume) {
      setControlsLoading((prev) => ({ ...prev, resume: true }));
      sendMessage('admin-resume-game');
      setGameState((prev) => ({ ...prev, status: 'playing' }));
      setTimeout(() => setControlsLoading((prev) => ({ ...prev, resume: false })), 500);
    }
  }, [sendMessage, controlsLoading.resume]);

  const endGame = useCallback(() => {
    if (!controlsLoading.end && window.confirm('¿Estás seguro de terminar el juego?')) {
      setControlsLoading((prev) => ({ ...prev, end: true }));
      sendMessage('admin-end-game');
      setGameState((prev) => ({ ...prev, status: 'ended' }));
      setTimeout(() => setControlsLoading((prev) => ({ ...prev, end: false })), 500);
    }
  }, [sendMessage, controlsLoading.end]);

  const callNumber = useCallback((number) => {
    if (gameState.status === 'playing' && !controlsLoading.callNumber) {
      setControlsLoading((prev) => ({ ...prev, callNumber: true }));
      sendMessage('admin-call-number', { number });
      setTimeout(() => setControlsLoading((prev) => ({ ...prev, callNumber: false })), 300);
    }
  }, [sendMessage, gameState.status, controlsLoading.callNumber]);

  const callRandomNumber = useCallback(() => {
    if (availableNumbers.length > 0 && gameState.status === 'playing' && !controlsLoading.callNumber) {
      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      const number = availableNumbers[randomIndex];
      callNumber(number);
    }
  }, [availableNumbers, gameState.status, callNumber, controlsLoading.callNumber]);

  // Card search function
  const handleCardSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!cardSearchQuery.trim()) return;

    setSearchLoading(true);
    setSearchResults([]);
    setSelectedCard(null);

    try {
      const adminToken = localStorage.getItem('admin-token');
      const response = await fetch(`${config.apiUrl}/api/admin/cards/search?query=${encodeURIComponent(cardSearchQuery)}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (!response.ok) {
        throw new Error('Error buscando cartones');
      }

      const data = await response.json();
      setSearchResults(data.cards || []);
    } catch (err) {
      console.error('Error searching cards:', err);
      setError(err.message);
    } finally {
      setSearchLoading(false);
    }
  }, [cardSearchQuery]);

  // Get card details with winner check
  const handleSelectCard = useCallback(async (cardId) => {
    try {
      const adminToken = localStorage.getItem('admin-token');
      const response = await fetch(`${config.apiUrl}/api/admin/cards/${cardId}/details`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (!response.ok) {
        throw new Error('Error obteniendo detalles del cartón');
      }

      const data = await response.json();
      setSelectedCard(data);
    } catch (err) {
      console.error('Error getting card details:', err);
      setError(err.message);
    }
  }, []);

  // Verify winner from selected card
  const handleVerifySelectedCard = useCallback(() => {
    if (selectedCard) {
      sendMessage('admin-verify-winner', { cardId: selectedCard.card.id });
    }
  }, [sendMessage, selectedCard]);

  // Login form - SECURITY: Requires wallet + password
  if (!isAuthenticated) {
    return (
      <div className="container admin-login">
        <div className="login-card card">
          <h1>Panel de Administrador</h1>
          <p>Conecta tu wallet y ingresa la contraseña</p>

          {/* Wallet connection status */}
          <div className="wallet-status" style={{ marginBottom: '1rem', padding: '0.5rem', borderRadius: '8px', background: walletConnected ? '#10b98120' : '#f59e0b20' }}>
            {walletConnected ? (
              <span style={{ color: '#10b981' }}>
                Wallet: {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleConnectWallet}
                className="btn-secondary"
                style={{ width: '100%' }}
              >
                Conectar Wallet
              </button>
            )}
          </div>

          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="input"
              autoFocus
              disabled={!walletConnected}
            />
            {error && <div className="error-text">{error}</div>}
            <button
              type="submit"
              className="btn-primary"
              disabled={!walletConnected}
            >
              Ingresar
            </button>
          </form>
        </div>
      </div>
    );
  }

  const { status, calledNumbers, currentNumber } = gameState;

  return (
    <div className="container admin">
      <header className="admin-header">
        <h1>Panel de Administrador</h1>
        <div className="header-right">
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '● Conectado' : '○ Desconectado'}
          </span>
          <button onClick={handleLogout} className="btn-logout">
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Game Status */}
      <section className="game-status-section card">
        <div className="status-badge" data-status={status}>
          {status === 'waiting' && 'Esperando'}
          {status === 'playing' && 'En Juego'}
          {status === 'paused' && 'Pausado'}
          {status === 'ended' && 'Terminado'}
        </div>

        <div className="game-controls">
          {status === 'waiting' && (
            <button
              onClick={startGame}
              className="btn-primary btn-control"
              disabled={controlsLoading.start || !isConnected}
            >
              {controlsLoading.start ? 'Iniciando...' : 'Iniciar Bingo'}
            </button>
          )}
          {status === 'playing' && (
            <>
              <button
                onClick={pauseGame}
                className="btn-control btn-warning"
                disabled={controlsLoading.pause || !isConnected}
              >
                {controlsLoading.pause ? 'Pausando...' : 'Pausar'}
              </button>
              <button
                onClick={endGame}
                className="btn-control btn-danger"
                disabled={controlsLoading.end || !isConnected}
              >
                {controlsLoading.end ? 'Terminando...' : 'Terminar'}
              </button>
            </>
          )}
          {status === 'paused' && (
            <>
              <button
                onClick={resumeGame}
                className="btn-primary btn-control"
                disabled={controlsLoading.resume || !isConnected}
              >
                {controlsLoading.resume ? 'Reanudando...' : 'Reanudar'}
              </button>
              <button
                onClick={endGame}
                className="btn-control btn-danger"
                disabled={controlsLoading.end || !isConnected}
              >
                {controlsLoading.end ? 'Terminando...' : 'Terminar'}
              </button>
            </>
          )}
          {status === 'ended' && (
            <button
              onClick={startGame}
              className="btn-primary btn-control"
              disabled={controlsLoading.start || !isConnected}
            >
              {controlsLoading.start ? 'Iniciando...' : 'Nuevo Juego'}
            </button>
          )}
        </div>
      </section>

      {/* Current Number */}
      <section className="current-section">
        <h2>Número Actual</h2>
        {currentNumber ? (
          <NumberBall number={currentNumber} size="huge" />
        ) : (
          <div className="no-number">-</div>
        )}
        <div className="called-count">
          {calledNumbers.length} / 75 números cantados
        </div>
      </section>

      {/* Random Call Button */}
      {status === 'playing' && (
        <section className="random-section">
          <button
            onClick={callRandomNumber}
            className="btn-primary btn-random"
            disabled={availableNumbers.length === 0 || controlsLoading.callNumber || !isConnected}
          >
            {controlsLoading.callNumber ? 'Cantando...' : 'Cantar Numero Aleatorio'}
          </button>
        </section>
      )}

      {/* Number Selector */}
      <section className="numbers-section">
        <h2>Seleccionar Número</h2>
        <div className="numbers-grid">
          {ALL_NUMBERS.map((num) => {
            const isCalled = calledNumbers.includes(num);
            return (
              <button
                key={num}
                onClick={() => !isCalled && callNumber(num)}
                className={`number-btn ${isCalled ? 'called' : ''} ${num === currentNumber ? 'current' : ''}`}
                disabled={isCalled || status !== 'playing' || !isConnected}
              >
                {num}
              </button>
            );
          })}
        </div>
      </section>

      {/* Called Numbers History */}
      <section className="history-section">
        <h2>Historial</h2>
        <div className="history-list">
          {calledNumbers.length === 0 ? (
            <p className="no-history">No hay números cantados</p>
          ) : (
            calledNumbers.map((num, index) => (
              <NumberBall key={num} number={num} size="small" />
            ))
          )}
        </div>
      </section>

      {/* Card Search Section */}
      <section className="card-search-section card">
        <h2>Buscar Cartón</h2>
        <form onSubmit={handleCardSearch} className="card-search-form">
          <input
            type="text"
            value={cardSearchQuery}
            onChange={(e) => setCardSearchQuery(e.target.value)}
            placeholder="Buscar por ID o wallet..."
            className="input card-search-input"
          />
          <button type="submit" className="btn-primary" disabled={searchLoading}>
            {searchLoading ? 'Buscando...' : 'Buscar'}
          </button>
        </form>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="search-results">
            <h3>Resultados ({searchResults.length})</h3>
            <div className="search-results-list">
              {searchResults.map((result) => (
                <div
                  key={result.card.id}
                  className={`search-result-item ${selectedCard?.card.id === result.card.id ? 'selected' : ''}`}
                  onClick={() => handleSelectCard(result.card.id)}
                >
                  <span className="result-id">#{result.card.id.slice(-8)}</span>
                  <span className="result-owner">@{result.ownerUsername || 'Anónimo'}</span>
                  <span className="result-wallet">{result.ownerWallet?.slice(0, 8)}...</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Card Details with Visual */}
        {selectedCard && (
          <div className="selected-card-details">
            <h3>Detalles del Cartón</h3>
            <div className="card-detail-grid">
              <div className="card-visual-container">
                <BingoCard
                  card={selectedCard.card}
                  calledNumbers={calledNumbers}
                  size="normal"
                />
              </div>
              <div className="card-info-panel">
                <div className="info-row">
                  <span className="info-label">ID:</span>
                  <span className="info-value">{selectedCard.card.id}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Dueño:</span>
                  <span className="info-value">@{selectedCard.ownerUsername || 'Anónimo'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Wallet:</span>
                  <span className="info-value">{selectedCard.ownerWallet}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Modo:</span>
                  <span className="info-value">{selectedCard.patternInfo?.name || gameState.gameMode}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Progreso:</span>
                  <span className="info-value progress-value">
                    {selectedCard.progress?.completed || 0} / {selectedCard.progress?.total || 24}
                    <div
                      className="progress-bar"
                      style={{
                        width: `${((selectedCard.progress?.completed || 0) / (selectedCard.progress?.total || 24)) * 100}%`
                      }}
                    />
                  </span>
                </div>

                {/* Winner Check Result */}
                {selectedCard.isWinner && (
                  <div className="winner-badge">
                    ¡BINGO! - {selectedCard.winPattern}
                  </div>
                )}

                {/* Verify Winner Button */}
                {status === 'playing' && selectedCard.isWinner && (
                  <button
                    onClick={handleVerifySelectedCard}
                    className="btn-primary btn-verify-winner"
                    disabled={!isConnected}
                  >
                    Verificar y Declarar Ganador
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default Admin;
