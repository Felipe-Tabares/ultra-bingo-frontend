import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { BingoCard } from '../components/bingo';
import { AnimatedBackground, GlassCard, GlowButton } from '../components/ui';
import { config } from '../config';
import './MyCards.css';

function MyCards() {
  const { user, isLoggedIn, openLoginModal } = useAuth();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchCards() {
      if (!user?.token) {
        setLoading(false);
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
        setCards(data.cards || []);
      } catch (err) {
        setError('Error cargando tus cartones');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchCards();
  }, [user]);

  if (!isLoggedIn) {
    return (
      <div className="my-cards-page">
        <AnimatedBackground />
        <div className="container my-cards-content">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <GlassCard className="auth-required" glow>
              <motion.div
                className="auth-icon"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
              </motion.div>
              <h2>Inicia sesion para ver tus cartones</h2>
              <p>Ingresa tu nombre de usuario y conecta tu wallet para acceder a tus cartones comprados</p>
              <GlowButton
                onClick={openLoginModal}
                size="lg"
                icon={
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                }
              >
                Iniciar Sesion
              </GlowButton>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-cards-page">
      <AnimatedBackground />

      <div className="container my-cards-content">
        {/* Header */}
        <motion.header
          className="my-cards-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="header-badge">
            <span>Mi Coleccion</span>
          </div>
          <h1>Mis Cartones</h1>
          <p>Gestiona y visualiza todos tus cartones de bingo</p>
        </motion.header>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="error-message"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <span className="error-icon">!</span>
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="cards-grid">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="bingo-card-skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
              />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <GlassCard className="no-cards" glow>
              <motion.div
                className="empty-icon"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🎰
              </motion.div>
              <h3>Tu coleccion esta vacia</h3>
              <p>Aun no has comprado ningun carton de bingo. Compra ahora y participa en el proximo juego.</p>
              <Link to="/">
                <GlowButton size="lg">
                  Comprar Cartones
                </GlowButton>
              </Link>
            </GlassCard>
          </motion.div>
        ) : (
          <>
            {/* Stats bar */}
            <motion.div
              className="cards-stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <GlassCard className="stat-card">
                <span className="stat-icon">🎫</span>
                <div className="stat-info">
                  <motion.span
                    className="stat-value"
                    key={cards.length}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                  >
                    {cards.length}
                  </motion.span>
                  <span className="stat-label">Carton{cards.length > 1 ? 'es' : ''}</span>
                </div>
              </GlassCard>

              <GlassCard className="stat-card">
                <span className="stat-icon">💰</span>
                <div className="stat-info">
                  <span className="stat-value">${(cards.length * config.cardPrice).toFixed(2)}</span>
                  <span className="stat-label">Invertido</span>
                </div>
              </GlassCard>

              <GlassCard className="stat-card status">
                <span className="stat-icon">🔴</span>
                <div className="stat-info">
                  <span className="stat-value">Listo</span>
                  <span className="stat-label">Para jugar</span>
                </div>
              </GlassCard>
            </motion.div>

            {/* Cards grid */}
            <motion.div
              className="cards-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <AnimatePresence>
                {cards.map((card, index) => (
                  <BingoCard
                    key={card.id}
                    card={card}
                    showStamp={false}
                    index={index}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          </>
        )}

        {/* CTA Section */}
        {cards.length > 0 && (
          <motion.div
            className="cta-section"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <GlassCard className="cta-card">
              <div className="cta-content">
                <div className="cta-text">
                  <h3>Listo para jugar?</h3>
                  <p>Unete al bingo en vivo y compite por increibles premios</p>
                </div>
                <div className="cta-buttons">
                  <Link to="/bingo-live">
                    <GlowButton size="lg">
                      Ir al Bingo Live
                    </GlowButton>
                  </Link>
                  <Link to="/">
                    <GlowButton variant="outline" size="lg">
                      Comprar Mas
                    </GlowButton>
                  </Link>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default MyCards;
