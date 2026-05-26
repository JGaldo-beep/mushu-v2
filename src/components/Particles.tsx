import { useEffect, useRef } from "react";

type ParticlesProps = {
  className?: string;
  quantity?: number;
  color?: string;
  size?: number;
  opacity?: number;
};

type Particle = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
};

export function Particles({
  className,
  quantity = 36,
  color = "#81B09A",
  size = 1.4,
  opacity = 0.22,
}: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let raf = 0;
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = Array.from({ length: quantity }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * size + 0.4,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
      }));
    };

    const tick = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };

    resize();
    tick();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [quantity, color, size, opacity]);

  return (
    <div ref={wrapRef} className={className} aria-hidden>
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}
