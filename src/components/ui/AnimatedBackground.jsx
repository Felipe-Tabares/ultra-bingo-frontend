import { useEffect, useRef } from 'react';
import './AnimatedBackground.css';

function AnimatedBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    // Subtle winter color palette - soft and elegant
    const christmasColors = [
      { h: 210, s: 20, l: 70 },   // Soft blue-gray
      { h: 200, s: 25, l: 75 },   // Light steel blue
      { h: 0, s: 0, l: 85 },      // Soft white
      { h: 0, s: 0, l: 90 },      // Near white
      { h: 220, s: 15, l: 65 },   // Muted blue
      { h: 180, s: 15, l: 60 },   // Soft teal hint
      { h: 40, s: 20, l: 70 },    // Warm cream (subtle)
    ];

    const createParticle = () => {
      const color = christmasColors[Math.floor(Math.random() * christmasColors.length)];
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.8 + 0.3,
        speedX: (Math.random() - 0.5) * 0.2,
        speedY: Math.random() * 0.3 + 0.1, // Gentle snow fall
        opacity: Math.random() * 0.35 + 0.15, // More subtle
        hue: color.h,
        saturation: color.s,
        lightness: color.l,
      };
    };

    const initParticles = () => {
      particles = [];
      const particleCount = Math.floor((canvas.width * canvas.height) / 15000);
      for (let i = 0; i < particleCount; i++) {
        particles.push(createParticle());
      }
    };

    const drawParticle = (particle) => {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${particle.hue}, ${particle.saturation}%, ${particle.lightness}%, ${particle.opacity})`;
      ctx.fill();

      // Subtle glow effect
      ctx.shadowBlur = 8;
      ctx.shadowColor = `hsla(${particle.hue}, ${particle.saturation}%, ${particle.lightness}%, 0.2)`;
    };

    const connectParticles = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 100) {
            ctx.beginPath();
            // Subtle frost connection lines
            ctx.strokeStyle = `rgba(180, 200, 220, ${0.06 * (1 - distance / 100)})`;
            ctx.lineWidth = 0.3;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw very subtle gradient overlay
      const gradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width / 1.2
      );
      gradient.addColorStop(0, 'rgba(100, 120, 140, 0.01)');
      gradient.addColorStop(0.5, 'rgba(80, 100, 120, 0.01)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles (snow falling effect)
      particles.forEach((particle) => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        // Horizontal wrap
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;

        // Reset to top when particle falls below screen
        if (particle.y > canvas.height) {
          particle.y = -10;
          particle.x = Math.random() * canvas.width;
        }

        drawParticle(particle);
      });

      connectParticles();
      animationFrameId = requestAnimationFrame(animate);
    };

    resize();
    initParticles();
    animate();

    window.addEventListener('resize', () => {
      resize();
      initParticles();
    });

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="animated-background" />
      <div className="gradient-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="orb orb-4" />
        <div className="orb orb-5" />
        <div className="orb orb-6" />
      </div>
    </>
  );
}

export default AnimatedBackground;
