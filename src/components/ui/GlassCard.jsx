import { motion } from 'framer-motion';
import './GlassCard.css';

function GlassCard({
  children,
  className = '',
  hover = true,
  glow = false,
  delay = 0,
  onClick,
  ...props
}) {
  return (
    <motion.div
      className={`glass-card ${hover ? 'hoverable' : ''} ${glow ? 'glowing' : ''} ${className}`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={hover ? {
        y: -5,
        transition: { duration: 0.2 },
      } : {}}
      onClick={onClick}
      {...props}
    >
      <div className="glass-card-border" />
      <div className="glass-card-content">
        {children}
      </div>
      {glow && <div className="glass-card-glow" />}
    </motion.div>
  );
}

export default GlassCard;
