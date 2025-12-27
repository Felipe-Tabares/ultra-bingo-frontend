import { motion } from 'framer-motion';
import './Footer.css';

function Footer() {
  return (
    <footer className="footer">
      {/* Top gradient border */}
      <div className="footer-border" />

      <div className="container footer-content">
        <motion.div
          className="footer-brand"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="footer-logo">
            <span>🎄 Ultra</span>
            <span className="highlight">Bingo</span>
            <span> 🎅</span>
          </span>
          <p className="footer-tagline">
            Feliz Navidad! Bingo descentralizado para la comunidad de UltravioletaDAO
          </p>
        </motion.div>

        <motion.div
          className="footer-links"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <a
            href="https://ultravioletadao.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            <span className="link-icon">🌐</span>
            <span>UltravioletaDAO</span>
          </a>
          <a
            href="https://twitter.com/ultravioletadao"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="link-icon-svg">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span>X / Twitter</span>
          </a>
        </motion.div>

        <motion.div
          className="footer-powered"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <span className="powered-text">Pagos seguros con</span>
          <motion.span
            className="powered-x402"
            whileHover={{ scale: 1.05 }}
          >
            x402
          </motion.span>
        </motion.div>
      </div>

      <div className="footer-bottom">
        <div className="container">
          <p>🎁 &copy; 2024 UltraBingo - Felices Fiestas! ❄️ Todos los derechos reservados. 🎁</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
