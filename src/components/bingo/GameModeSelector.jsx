import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../ui';
import { config } from '../../config';
import './GameModeSelector.css';

// Patrones ULTRA visuales (5x5 grid, true = casilla requerida)
const PATTERN_VISUALS = {
  fullCard: {
    grid: [
      [1,1,1,1,1],
      [1,1,1,1,1],
      [1,1,0,1,1], // Centro es FREE
      [1,1,1,1,1],
      [1,1,1,1,1],
    ],
  },
  letterU: {
    grid: [
      [1,0,0,0,1],
      [1,0,0,0,1],
      [1,0,0,0,1],
      [1,0,0,0,1],
      [1,1,1,1,1],
    ],
  },
  letterL: {
    grid: [
      [1,0,0,0,0],
      [1,0,0,0,0],
      [1,0,0,0,0],
      [1,0,0,0,0],
      [1,1,1,1,1],
    ],
  },
  letterT: {
    grid: [
      [1,1,1,1,1],
      [0,0,1,0,0],
      [0,0,1,0,0],
      [0,0,1,0,0],
      [0,0,1,0,0],
    ],
  },
  letterR: {
    grid: [
      [1,1,1,1,0],
      [1,0,0,1,0],
      [1,1,1,1,0],
      [1,0,1,0,0],
      [1,0,0,1,0],
    ],
  },
  letterA: {
    grid: [
      [0,1,1,1,0],
      [1,0,0,0,1],
      [1,1,1,1,1],
      [1,0,0,0,1],
      [1,0,0,0,1],
    ],
  },
  line: {
    grid: [
      [1,0,0,0,0],
      [0,1,0,0,0],
      [0,0,1,0,0],
      [0,0,0,1,0],
      [0,0,0,0,1],
    ],
  },
  corners: {
    grid: [
      [1,0,0,0,1],
      [0,0,0,0,0],
      [0,0,0,0,0],
      [0,0,0,0,0],
      [1,0,0,0,1],
    ],
  },
};

function MiniCard({ pattern, isActive, onClick, disabled }) {
  const grid = PATTERN_VISUALS[pattern.key]?.grid || PATTERN_VISUALS.fullCard.grid;

  return (
    <motion.div
      className={`gm-card-wrapper ${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      whileHover={disabled ? {} : { scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
    >
      <div className="gm-card">
        <div className="gm-card-header">
          <span>B</span><span>I</span><span>N</span><span>G</span><span>O</span>
        </div>
        <div className="gm-card-grid">
          {grid.map((row, rowIndex) => (
            <div key={rowIndex} className="gm-card-row">
              {row.map((cell, colIndex) => (
                <div
                  key={colIndex}
                  className={`gm-card-cell ${cell ? 'highlighted' : ''} ${rowIndex === 2 && colIndex === 2 ? 'free' : ''}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="gm-card-info">
        <span className="gm-card-name">{pattern.name}</span>
      </div>
      {isActive && (
        <motion.div
          className="gm-active-indicator"
          layoutId="activeMode"
          initial={false}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}
    </motion.div>
  );
}

function GameModeSelector({ isAdmin, currentMode, gameStatus, onModeChange }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [modes, setModes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);

  // Fetch available modes
  useEffect(() => {
    async function fetchModes() {
      try {
        const response = await fetch(`${config.apiUrl}/api/game/modes`);
        if (response.ok) {
          const data = await response.json();
          setModes(data.modes);
        }
      } catch (err) {
        console.error('Error fetching game modes:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchModes();
  }, []);

  const canChangeMode = isAdmin && (gameStatus === 'waiting' || gameStatus === 'ended');
  const currentModeInfo = modes.find(m => m.key === currentMode) || { name: 'Cargando...', description: '' };

  const handleModeChange = async (modeKey) => {
    if (!canChangeMode || changing) return;

    setChanging(true);
    try {
      await onModeChange(modeKey);
      setIsExpanded(false);
    } catch (err) {
      console.error('Error changing mode:', err);
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="game-mode-selector">
      {/* Current Mode Display (always visible) */}
      <motion.div
        className="current-mode-display"
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.02 }}
      >
        <div className="mode-label">
          <span className="mode-icon">🎯</span>
          <span className="mode-text">Modo de Juego:</span>
        </div>
        <div className="mode-value">
          <MiniCard
            pattern={{ key: currentMode, name: currentModeInfo.name }}
            isActive={true}
            disabled={true}
          />
        </div>
        <motion.div
          className="expand-icon"
          animate={{ rotate: isExpanded ? 180 : 0 }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
          </svg>
        </motion.div>
      </motion.div>

      {/* Expandable Mode Selector */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="mode-selector-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <GlassCard className="mode-selector-card">
              <div className="mode-selector-header">
                <h3>Seleccionar Modo de Juego</h3>
                {!canChangeMode && (
                  <span className="mode-locked">
                    {!isAdmin
                      ? 'Solo el administrador puede cambiar el modo'
                      : 'No se puede cambiar durante el juego'}
                  </span>
                )}
              </div>

              {loading ? (
                <div className="mode-loading">Cargando modos...</div>
              ) : (
                <div className="modes-grid">
                  {modes.map((mode) => (
                    <MiniCard
                      key={mode.key}
                      pattern={mode}
                      isActive={mode.key === currentMode}
                      onClick={() => handleModeChange(mode.key)}
                      disabled={!canChangeMode || changing}
                    />
                  ))}
                </div>
              )}

              {currentModeInfo.description && (
                <div className="mode-description">
                  <strong>{currentModeInfo.name}:</strong> {currentModeInfo.description}
                </div>
              )}
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GameModeSelector;
