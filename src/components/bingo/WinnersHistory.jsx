import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { config } from '../../config';
import './WinnersHistory.css';

function WinnersHistory() {
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch winners on mount and periodically
  useEffect(() => {
    fetchWinners();

    // Refresh every 30 seconds
    const interval = setInterval(fetchWinners, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchWinners = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/game/winners?limit=10`);
      if (!response.ok) throw new Error('Failed to fetch winners');

      const data = await response.json();
      setWinners(data.winners || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching winners:', err);
      setError('Error cargando ganadores');
    } finally {
      setLoading(false);
    }
  };

  // Format date to relative time
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;

    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  // Format wallet address
  const formatWallet = (wallet) => {
    if (!wallet) return '';
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  // Get pattern display name
  const getPatternName = (patternName, gameMode) => {
    const names = {
      fullCard: 'Cartón Completo',
      letterU: 'Letra U',
      letterL: 'Letra L',
      letterT: 'Letra T',
      letterR: 'Letra R',
      letterA: 'Letra A',
      line: 'Línea',
      corners: '4 Esquinas',
    };
    return names[patternName] || names[gameMode] || patternName || 'Bingo';
  };

  if (loading) {
    return (
      <div className="winners-history winners-loading">
        <div className="winners-header">
          <span className="winners-icon">🏆</span>
          <h3>Ganadores Recientes</h3>
        </div>
        <div className="winners-skeleton">
          {[1, 2, 3].map((i) => (
            <div key={i} className="winner-skeleton-item" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="winners-history">
      <div className="winners-header">
        <span className="winners-icon">🏆</span>
        <h3>Ganadores Recientes</h3>
      </div>

      {error && (
        <div className="winners-error">
          {error}
          <button onClick={fetchWinners}>Reintentar</button>
        </div>
      )}

      {!error && winners.length === 0 && (
        <div className="winners-empty">
          <span className="empty-icon">🎱</span>
          <p>Aún no hay ganadores</p>
          <span className="empty-hint">¡Sé el primero en ganar!</span>
        </div>
      )}

      <AnimatePresence>
        {winners.length > 0 && (
          <motion.div
            className="winners-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {winners.map((winner, index) => (
              <motion.div
                key={winner.winnerId}
                className={`winner-item ${index === 0 ? 'latest' : ''}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="winner-rank">
                  {index === 0 ? '👑' : `#${index + 1}`}
                </div>
                <div className="winner-info">
                  <span className="winner-username">@{winner.odUsername}</span>
                  <span className="winner-wallet">{formatWallet(winner.wallet)}</span>
                </div>
                <div className="winner-details">
                  <span className="winner-pattern">{getPatternName(winner.patternName, winner.gameMode)}</span>
                  <span className="winner-time">{formatDate(winner.wonAt)}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {winners.length > 0 && (
        <div className="winners-footer">
          <button className="refresh-btn" onClick={fetchWinners}>
            Actualizar
          </button>
        </div>
      )}
    </div>
  );
}

export default WinnersHistory;
