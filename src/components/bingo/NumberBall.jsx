import { motion } from 'framer-motion';
import './NumberBall.css';

// Get the letter for a bingo number
function getLetterForNumber(number) {
  if (number >= 1 && number <= 15) return 'B';
  if (number >= 16 && number <= 30) return 'I';
  if (number >= 31 && number <= 45) return 'N';
  if (number >= 46 && number <= 60) return 'G';
  if (number >= 61 && number <= 75) return 'O';
  return '';
}

// Get color based on column letter - Christmas Winter Theme
function getColumnColor(letter) {
  const colors = {
    // B - Christmas Red
    B: {
      gradient: 'linear-gradient(135deg, #c41e3a 0%, #8b0000 100%)',
      glow: 'rgba(196, 30, 58, 0.6)',
      snowflake: true
    },
    // I - Ice Blue (winter)
    I: {
      gradient: 'linear-gradient(135deg, #4fc3f7 0%, #0288d1 100%)',
      glow: 'rgba(79, 195, 247, 0.6)',
      snowflake: true
    },
    // N - Snow White/Silver
    N: {
      gradient: 'linear-gradient(135deg, #ffffff 0%, #b0bec5 100%)',
      glow: 'rgba(255, 255, 255, 0.6)',
      textDark: true,
      snowflake: true
    },
    // G - Christmas Green
    G: {
      gradient: 'linear-gradient(135deg, #228b22 0%, #006400 100%)',
      glow: 'rgba(34, 139, 34, 0.6)',
      snowflake: true
    },
    // O - Gold
    O: {
      gradient: 'linear-gradient(135deg, #ffd700 0%, #daa520 100%)',
      glow: 'rgba(255, 215, 0, 0.6)',
      textDark: true,
      snowflake: true
    },
  };
  return colors[letter] || colors.B;
}

function NumberBall({
  number,
  size = 'normal',
  animate = false,
  called = false,
  index = 0,
  current = false,
}) {
  const letter = getLetterForNumber(number);
  const colors = getColumnColor(letter);

  const sizeClasses = {
    small: 'small',
    normal: 'normal',
    large: 'large',
    huge: 'huge',
  };

  return (
    <motion.div
      className={`number-ball ${sizeClasses[size]} ${called ? 'called' : ''} ${current ? 'current' : ''} ${colors.textDark ? 'text-dark' : ''}`}
      data-letter={letter}
      initial={animate ? { scale: 0, rotate: -180, opacity: 0 } : false}
      animate={animate ? {
        scale: 1,
        rotate: 0,
        opacity: 1,
      } : {}}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 15,
        delay: index * 0.05,
      }}
      whileHover={{
        scale: 1.1,
        rotate: [0, -5, 5, 0],
        transition: { duration: 0.3 }
      }}
      style={{
        background: called ? undefined : colors.gradient,
        boxShadow: called ? undefined : `0 0 25px ${colors.glow}, 0 8px 25px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.4)`,
      }}
    >
      {/* Inner glow */}
      <div className="ball-glow" />

      {/* 3D shine effect */}
      <div className="ball-shine" />

      <div className="ball-inner">
        <motion.span
          className="ball-letter"
          initial={animate ? { y: -10, opacity: 0 } : false}
          animate={animate ? { y: 0, opacity: 0.9 } : {}}
          transition={{ delay: 0.2 + index * 0.05 }}
        >
          {letter}
        </motion.span>
        <motion.span
          className="ball-number"
          initial={animate ? { scale: 0 } : false}
          animate={animate ? { scale: 1 } : {}}
          transition={{
            type: 'spring',
            stiffness: 500,
            delay: 0.1 + index * 0.05
          }}
        >
          {number}
        </motion.span>
      </div>

      {/* Pulse ring animation for current */}
      {current && (
        <>
          <motion.div
            className="pulse-ring"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.div
            className="pulse-ring"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
          />
        </>
      )}
    </motion.div>
  );
}

export default NumberBall;
