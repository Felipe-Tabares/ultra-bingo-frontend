import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors';
import { config } from '../config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Wagmi hooks for wallet connection
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('ultra-bingo-user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('ultra-bingo-user');
      }
    }
    setLoading(false);
  }, []);

  // Sync user state across tabs via storage event
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'ultra-bingo-user') {
        if (e.newValue) {
          try {
            setUser(JSON.parse(e.newValue));
          } catch {
            setUser(null);
          }
        } else {
          // User was removed (logout in another tab)
          setUser(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Update user wallet when connected
  useEffect(() => {
    if (isConnected && address && user && !user.wallet) {
      const updatedUser = { ...user, wallet: address };
      setUser(updatedUser);
      localStorage.setItem('ultra-bingo-user', JSON.stringify(updatedUser));

      // Register user in backend
      registerUser(updatedUser);
    }
  }, [isConnected, address, user]);

  // Register user in backend
  const registerUser = async (userData) => {
    try {
      const response = await fetch(`${config.apiUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userData.username,
          wallet: userData.wallet,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const updatedUser = { ...userData, id: data.user.id, token: data.token };
        setUser(updatedUser);
        localStorage.setItem('ultra-bingo-user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      // Silent fail - user session will be created on next login
    }
  };

  // Open login modal
  const openLoginModal = useCallback(() => {
    setShowLoginModal(true);
  }, []);

  // Close login modal
  const closeLoginModal = useCallback(() => {
    setShowLoginModal(false);
  }, []);

  // Login with username (step 1)
  const loginWithUsername = useCallback((username) => {
    const newUser = {
      id: null,
      username: username.trim(),
      wallet: null,
      token: null,
    };
    setUser(newUser);
    localStorage.setItem('ultra-bingo-user', JSON.stringify(newUser));
    return newUser;
  }, []);

  // Connect wallet (step 2)
  const connectWallet = useCallback(async (connectorType = 'injected') => {
    try {
      let connector;
      switch (connectorType) {
        case 'coinbase':
          connector = coinbaseWallet({ appName: 'UltraBingo' });
          break;
        case 'walletconnect':
          connector = walletConnect({
            projectId: config.walletConnectProjectId || 'demo',
          });
          break;
        default:
          connector = injected();
      }
      connect({ connector });
    } catch (error) {
      // Wallet connection error - handled by wagmi
    }
  }, [connect]);

  // Complete login (username + wallet)
  const completeLogin = useCallback(async (username) => {
    if (!isConnected || !address) {
      throw new Error('Wallet not connected');
    }

    const newUser = {
      id: null,
      username: username.trim(),
      wallet: address,
      token: null,
      isAdmin: false,
    };

    // Register in backend
    try {
      const response = await fetch(`${config.apiUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUser.username,
          wallet: newUser.wallet,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        newUser.id = data.user.id;
        newUser.token = data.token;
        newUser.isAdmin = data.user.isAdmin || false;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Registration failed');
      }
    } catch (error) {
      throw error;
    }

    setUser(newUser);
    localStorage.setItem('ultra-bingo-user', JSON.stringify(newUser));
    setShowLoginModal(false);

    return newUser;
  }, [isConnected, address]);

  // Disconnect everything
  const disconnect = useCallback(() => {
    wagmiDisconnect();
    setUser(null);
    localStorage.removeItem('ultra-bingo-user');
  }, [wagmiDisconnect]);

  // Check if user is fully logged in (has username + wallet + token)
  const isLoggedIn = user?.username && user?.wallet && user?.token;

  // Check if user is admin
  const isAdmin = user?.isAdmin || false;

  // Get auth token for API calls
  const getToken = useCallback(() => {
    return user?.token || null;
  }, [user]);

  const value = {
    user,
    loading,
    isConnected,
    isLoggedIn,
    isAdmin,
    walletAddress: address || user?.wallet,
    showLoginModal,
    openLoginModal,
    closeLoginModal,
    loginWithUsername,
    connectWallet,
    completeLogin,
    disconnect,
    getToken,
    connectors,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
