import { motion } from 'framer-motion';
import './GlowButton.css';

function GlowButton({
  children,
  onClick,
  disabled = false,
  variant = 'primary', // 'primary', 'secondary', 'outline', 'ghost'
  size = 'md', // 'sm', 'md', 'lg', 'xl'
  fullWidth = false,
  icon = null,
  loading = false,
  className = '',
  ...props
}) {
  return (
    <motion.button
      className={`glow-button ${variant} ${size} ${fullWidth ? 'full-width' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
      }}
      {...props}
    >
      <span className="button-bg" />
      <span className="button-glow" />
      <span className="button-content">
        {loading ? (
          <span className="button-loader" />
        ) : (
          <>
            {icon && <span className="button-icon">{icon}</span>}
            {children}
          </>
        )}
      </span>
    </motion.button>
  );
}

export default GlowButton;
