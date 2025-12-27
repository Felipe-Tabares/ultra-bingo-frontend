import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { config } from '../../config';
import './UsersHistory.css';

function UsersHistory({ token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (token) {
      fetchUsers();
    }
  }, [token]);

  const fetchUsers = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch(`${config.apiUrl}/api/admin/users?limit=50`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('No autorizado');
        }
        throw new Error('Error al cargar usuarios');
      }

      const data = await response.json();
      setUsers(data.users || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Format date to readable format
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format relative time
  const formatRelativeTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 30) return `${diffDays}d`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  return (
    <div className={`users-history ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Toggle Header */}
      <motion.button
        className="users-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <span className="toggle-icon">👥</span>
        <span className="toggle-text">Usuarios Registrados</span>
        <span className="toggle-count">{users.length}</span>
        <motion.span
          className="toggle-arrow"
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          ▼
        </motion.span>
      </motion.button>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="users-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {loading && (
              <div className="users-loading">
                <div className="loading-spinner">⏳</div>
                <p>Cargando...</p>
              </div>
            )}

            {error && (
              <div className="users-error">
                <p>{error}</p>
                <button onClick={fetchUsers}>Reintentar</button>
              </div>
            )}

            {!loading && !error && users.length === 0 && (
              <div className="users-empty">
                <p>No hay usuarios registrados</p>
              </div>
            )}

            {!loading && !error && users.length > 0 && (
              <div className="users-list">
                {users.map((user, index) => (
                  <motion.div
                    key={user.odId}
                    className={`user-item ${user.isAdmin ? 'is-admin' : ''}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="uh-user-main">
                      <span className="uh-user-index">#{index + 1}</span>
                      <div className="uh-user-info">
                        <span className="uh-user-name">
                          @{user.username}
                          {user.isAdmin && <span className="uh-admin-badge">👑</span>}
                        </span>
                        <span className="uh-user-wallet">{user.wallet}</span>
                      </div>
                    </div>
                    <div className="uh-user-meta">
                      <span className="uh-user-date" title={formatDate(user.createdAt)}>
                        {formatRelativeTime(user.createdAt)}
                      </span>
                      <div className="uh-user-stats">
                        {user.cardsPurchased > 0 && (
                          <span title="Cartones comprados">🎟️{user.cardsPurchased}</span>
                        )}
                        {user.gamesWon > 0 && (
                          <span title="Bingos ganados">🏆{user.gamesWon}</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Refresh Button */}
            <div className="users-footer">
              <motion.button
                className="refresh-btn"
                onClick={fetchUsers}
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                🔄 Actualizar
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default UsersHistory;
