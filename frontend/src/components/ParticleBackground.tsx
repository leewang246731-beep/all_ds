import { useEffect, useRef, useCallback } from "react";

interface ParticleOptions {
  particleCount?: number;
  dotSizeMin?: number;
  dotSizeMax?: number;
  color?: string;
  opacity?: number;
  speed?: number;
  repulsionRadius?: number;
  connectionDistance?: number;
  lineOpacity?: number;
  lineWidth?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

const DEFAULT_OPTIONS: ParticleOptions = {
  particleCount: 80,
  dotSizeMin: 1.5,
  dotSizeMax: 3,
  color: "42, 107, 255",  // #2A6BFF as RGB
  opacity: 0.3,
  speed: 0.4,
  repulsionRadius: 80,
  connectionDistance: 120,
  lineOpacity: 0.08,
  lineWidth: 0.8,
};

export function ParticleBackground({ enabled = true }: { enabled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const optsRef = useRef<ParticleOptions>({ ...DEFAULT_OPTIONS });

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }, []);

  const createParticles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const opts = optsRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const particles: Particle[] = [];
    for (let i = 0; i < (opts.particleCount || 80); i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * (opts.speed || 0.4),
        vy: (Math.random() - 0.5) * (opts.speed || 0.4),
        radius: (opts.dotSizeMin || 1.5) + Math.random() * ((opts.dotSizeMax || 3) - (opts.dotSizeMin || 1.5)),
      });
    }
    particlesRef.current = particles;
  }, []);

  const drawParticle = useCallback((ctx: CanvasRenderingContext2D, p: Particle) => {
    const opts = optsRef.current;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${opts.color}, ${opts.opacity})`;
    ctx.fill();
  }, []);

  const drawLine = useCallback((ctx: CanvasRenderingContext2D, p1: Particle, p2: Particle) => {
    const opts = optsRef.current;
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > (opts.connectionDistance || 120)) return;
    const alpha = (opts.lineOpacity || 0.08) * (1 - dist / (opts.connectionDistance || 120));
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = `rgba(${opts.color}, ${alpha})`;
    ctx.lineWidth = opts.lineWidth || 0.8;
    ctx.stroke();
  }, []);

  const updateParticle = useCallback((p: Particle, width: number, height: number) => {
    const opts = optsRef.current;
    const mouse = mouseRef.current;

    p.x += p.vx;
    p.y += p.vy;

    // Boundary wrap
    if (p.x < -10) p.x = width + 10;
    if (p.x > width + 10) p.x = -10;
    if (p.y < -10) p.y = height + 10;
    if (p.y > height + 10) p.y = -10;

    // Mouse repulsion
    if (mouse.x > -500) {
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < (opts.repulsionRadius || 80) && dist > 0) {
        const force = ((opts.repulsionRadius || 80) - dist) / (opts.repulsionRadius || 80);
        const angle = Math.atan2(dy, dx);
        p.vx += Math.cos(angle) * force * 0.3;
        p.vy += Math.sin(angle) * force * 0.3;
      }
    }

    // Damping
    p.vx *= 0.995;
    p.vy *= 0.995;

    // Speed clamp
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    const maxSpeed = (opts.speed || 0.4) * 2;
    if (speed > maxSpeed) {
      p.vx = (p.vx / speed) * maxSpeed;
      p.vy = (p.vy / speed) * maxSpeed;
    }
  }, []);

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const particles = particlesRef.current;

    ctx.clearRect(0, 0, width, height);

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        drawLine(ctx, particles[i], particles[j]);
      }
    }

    // Draw particles
    for (const p of particles) {
      updateParticle(p, width, height);
      drawParticle(ctx, p);
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [drawLine, drawParticle, updateParticle]);

  useEffect(() => {
    if (!enabled) return;

    resize();
    createParticles();

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseleave", handleMouseLeave, { passive: true });

    loop();

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [enabled, resize, createParticles, loop]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
