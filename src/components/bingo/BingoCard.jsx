import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './BingoCard.css';

const COLUMNS = ['B', 'I', 'N', 'G', 'O'];

function BingoCard({
  card,
  calledNumbers = [],
  selectable = false,
  selected = false,
  onSelect,
  showStamp = true,
  size = 'normal',
  index = 0,
}) {
  const markedNumbers = useMemo(() => {
    return new Set(calledNumbers);
  }, [calledNumbers]);

  const grid = useMemo(() => {
    if (!card?.numbers) return null;

    const rows = [];
    for (let row = 0; row < 5; row++) {
      const rowCells = [];
      for (let col = 0; col < 5; col++) {
        const column = COLUMNS[col];
        const value = card.numbers[column][row];
        const isFree = value === 'FREE';
        const isMarked = isFree || markedNumbers.has(value);

        rowCells.push({
          value,
          column,
          isFree,
          isMarked,
          cellIndex: row * 5 + col,
        });
      }
      rows.push(rowCells);
    }
    return rows;
  }, [card, markedNumbers]);

  if (!grid) {
    return (
      <motion.div
        className="bingo-card-skeleton"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    );
  }

  const handleClick = () => {
    if (selectable && onSelect) {
      onSelect(card);
    }
  };

  return (
    <motion.div
      className={`bingo-card ${size} ${selectable ? 'selectable' : ''} ${selected ? 'selected' : ''}`}
      onClick={handleClick}
      initial={{ opacity: 0, scale: 0.8, rotateY: -15 }}
      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{
        duration: 0.5,
        delay: index * 0.05,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={selectable ? {
        scale: 1.02,
        rotateY: 2,
        rotateX: -2,
        transition: { duration: 0.2 },
      } : {}}
      whileTap={selectable ? { scale: 0.98 } : {}}
      style={{ perspective: '1000px' }}
    >
      {/* Animated border gradient */}
      <div className="card-border-glow" />

      {/* Header with BINGO letters */}
      <div className="bingo-header">
        {COLUMNS.map((letter, i) => (
          <motion.div
            key={letter}
            className="bingo-header-cell"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
          >
            {letter}
          </motion.div>
        ))}
      </div>

      {/* Grid */}
      <div className="bingo-grid">
        {grid.map((row, rowIndex) => (
          <div key={rowIndex} className="bingo-row">
            {row.map((cell, colIndex) => (
              <motion.div
                key={`${rowIndex}-${colIndex}`}
                className={`bingo-cell ${cell.isFree ? 'free' : ''} ${cell.isMarked ? 'marked' : ''}`}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  delay: 0.2 + cell.cellIndex * 0.02,
                  type: 'spring',
                  stiffness: 300,
                  damping: 20,
                }}
                whileHover={!cell.isMarked ? { scale: 1.1, zIndex: 10 } : {}}
              >
                <span className="cell-value">
                  {cell.isFree ? (
                    <motion.span
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      FREE
                    </motion.span>
                  ) : (
                    cell.value
                  )}
                </span>

                <AnimatePresence>
                  {cell.isMarked && showStamp && (
                    <motion.div
                      className="stamp"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 180 }}
                      transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 15,
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Cell glow effect when marked */}
                {cell.isMarked && (
                  <motion.div
                    className="cell-glow"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </motion.div>
            ))}
          </div>
        ))}
      </div>

      {/* Card ID with animated underline */}
      <motion.div
        className="bingo-card-id"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <span className="card-id-hash">#</span>
        <span className="card-id-value">{card.id?.slice(-6) || '------'}</span>
      </motion.div>

      {/* Selection indicator */}
      <AnimatePresence>
        {selectable && selected && (
          <motion.div
            className="selection-badge"
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 45 }}
            transition={{ type: 'spring', stiffness: 500 }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected overlay glow */}
      {selected && (
        <motion.div
          className="selected-glow"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          layoutId={`glow-${card.id}`}
        />
      )}
    </motion.div>
  );
}

export default BingoCard;
