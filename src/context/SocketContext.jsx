import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { config } from '../config';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState({
    status: 'waiting', // waiting, playing, paused, ended
    gameMode: 'fullCard', // Current game mode (ULTRA patterns)
    calledNumbers: [],
    currentNumber: null,
    winner: null,
    potentialWinners: [], // Cards that have completed BINGO
    canPurchase: true, // Whether card purchases are allowed
    patternInfo: null, // Current pattern info
    lastRejectedWinner: null, // Track last rejected winner for "Continua el juego" message
    showContinueMessage: false, // Show "Continua el juego" message
  });
  const hasReconnectedRef = useRef(false);
  const continueMessageTimeoutRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Get auth info from localStorage
  const getAuthInfo = () => {
    try {
      const savedUser = localStorage.getItem('ultra-bingo-user');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        return { token: user.token, isAdmin: user.isAdmin };
      }
    } catch (e) {
      console.error('Error reading auth info:', e);
    }
    return { token: null, isAdmin: false };
  };

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((event) => {
    try {
      const message = JSON.parse(event.data);
      const { type } = message;
      // Backend sends 'data', support both 'data' and 'payload' for compatibility
      const payload = message.data || message.payload || {};

      console.log('WebSocket message received:', type, payload);

      switch (type) {
        case 'game-state':
          setGameState((prev) => ({
            ...prev,
            ...payload,
            calledNumbers: payload?.calledNumbers || prev?.calledNumbers || [],
            potentialWinners: payload?.potentialWinners || prev?.potentialWinners || [],
          }));
          break;

        case 'number-called':
          setGameState((prev) => ({
            ...prev,
            currentNumber: payload.number,
            calledNumbers: payload.calledNumbers || [...(prev?.calledNumbers || []), payload.number],
          }));
          break;

        case 'game-started':
          setGameState((prev) => ({
            ...prev,
            status: 'playing',
            calledNumbers: [],
            currentNumber: null,
            winner: null,
            potentialWinners: [],
            canPurchase: false,
            gameMode: payload?.gameMode || prev?.gameMode || 'fullCard',
          }));
          break;

        case 'game-mode-changed':
          setGameState((prev) => ({
            ...prev,
            gameMode: payload.mode,
            patternInfo: payload.patternInfo || null,
          }));
          break;

        case 'game-paused':
          setGameState((prev) => ({
            ...prev,
            status: 'paused',
          }));
          break;

        case 'game-resumed':
          setGameState((prev) => ({
            ...prev,
            status: 'playing',
          }));
          break;

        case 'game-ended':
          setGameState((prev) => ({
            ...prev,
            status: 'ended',
            winner: payload?.winner || null,
            potentialWinners: [],
            canPurchase: true,
          }));
          break;

        case 'game-cleared':
          setGameState((prev) => ({
            ...prev,
            status: 'waiting',
            calledNumbers: [],
            currentNumber: null,
            winner: null,
            potentialWinners: [],
            canPurchase: true,
            showContinueMessage: false,
          }));
          break;

        case 'winner-announced':
          setGameState((prev) => ({
            ...prev,
            winner: payload?.winner || null,
            potentialWinners: [],
          }));
          break;

        case 'potential-winner':
          setGameState((prev) => {
            const currentWinners = prev?.potentialWinners || [];
            const exists = currentWinners.some(w => w.cardId === payload.cardId);
            if (exists) return prev;
            return {
              ...prev,
              potentialWinners: [...currentWinners, payload],
              showContinueMessage: false,
            };
          });
          break;

        case 'winner-rejected':
          setGameState((prev) => {
            const currentWinners = prev?.potentialWinners || [];
            return {
              ...prev,
              potentialWinners: currentWinners.filter(w => w.cardId !== payload.cardId),
              lastRejectedWinner: payload.cardId,
              showContinueMessage: true,
            };
          });
          if (continueMessageTimeoutRef.current) {
            clearTimeout(continueMessageTimeoutRef.current);
          }
          continueMessageTimeoutRef.current = setTimeout(() => {
            setGameState((prev) => ({
              ...prev,
              showContinueMessage: false,
            }));
            continueMessageTimeoutRef.current = null;
          }, 5000);
          break;

        case 'error':
          console.error('WebSocket error:', payload);
          break;

        default:
          console.log('Unknown message type:', type, payload);
      }
    } catch (e) {
      console.error('Error parsing WebSocket message:', e);
    }
  }, []);

  // Create WebSocket connection
  const createConnection = useCallback(() => {
    const { token } = getAuthInfo();

    // Build WebSocket URL with auth token as query param
    let wsUrl = config.wsUrl;
    if (token) {
      wsUrl += `?token=${encodeURIComponent(token)}`;
    }

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;

      // Join default game room after connection
      ws.send(JSON.stringify({
        action: 'join-game',
        gameId: 'default'
      }));
    };

    ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      setIsConnected(false);

      // Attempt to reconnect if not intentionally closed
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current++;
        console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
        reconnectTimeoutRef.current = setTimeout(() => {
          createConnection();
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = handleMessage;

    setSocket(ws);
    return ws;
  }, [handleMessage]);

  useEffect(() => {
    const ws = createConnection();

    return () => {
      if (continueMessageTimeoutRef.current) {
        clearTimeout(continueMessageTimeoutRef.current);
        continueMessageTimeoutRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent reconnection on unmount
      if (ws) {
        ws.close();
      }
    };
  }, [createConnection]);

  // Helper to send messages
  const sendMessage = useCallback((action, payload = {}) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action, ...payload }));
    } else {
      console.warn('WebSocket not connected, cannot send:', action);
    }
  }, [socket]);

  // Join a game room
  const joinGame = useCallback((gameId) => {
    sendMessage('join-game', { gameId });
  }, [sendMessage]);

  // Leave a game room
  const leaveGame = useCallback((gameId) => {
    sendMessage('leave-game', { gameId });
  }, [sendMessage]);

  // ============== ADMIN FUNCTIONS ==============

  // Admin: Start game
  const startGame = useCallback(() => {
    sendMessage('admin-start-game');
  }, [sendMessage]);

  // Admin: Pause game
  const pauseGame = useCallback(() => {
    sendMessage('admin-pause-game');
  }, [sendMessage]);

  // Admin: Resume game
  const resumeGame = useCallback(() => {
    sendMessage('admin-resume-game');
  }, [sendMessage]);

  // Admin: End game
  const endGame = useCallback((winner = null) => {
    sendMessage('admin-end-game', { winner });
  }, [sendMessage]);

  // Admin: Clear game (reset UI without starting new game)
  const clearGame = useCallback(() => {
    sendMessage('admin-clear-game');
  }, [sendMessage]);

  // Admin: Call number
  const callNumber = useCallback((number) => {
    sendMessage('admin-call-number', { number });
  }, [sendMessage]);

  // Admin: Verify winner
  const verifyWinner = useCallback((cardId) => {
    sendMessage('admin-verify-winner', { cardId });
  }, [sendMessage]);

  // Admin: Reject potential winner and resume game
  const rejectWinner = useCallback((cardId) => {
    sendMessage('admin-reject-winner', { cardId });
  }, [sendMessage]);

  // Admin: Set game mode
  const setGameMode = useCallback((mode) => {
    sendMessage('admin-set-game-mode', { mode });
  }, [sendMessage]);

  // Reconnect with new auth (useful after login)
  const reconnectWithAuth = useCallback(() => {
    if (socket && !hasReconnectedRef.current) {
      hasReconnectedRef.current = true;
      socket.close();
      setTimeout(() => {
        createConnection();
        setTimeout(() => {
          hasReconnectedRef.current = false;
        }, 5000);
      }, 100);
    }
  }, [socket, createConnection]);

  const value = {
    socket,
    isConnected,
    gameState,
    joinGame,
    leaveGame,
    // Admin functions
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
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
