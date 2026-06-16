import { useEffect, useRef, memo, useState } from "react";

interface Star {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
}

const ConstellationBackground = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [enabled, setEnabled] = useState(true);

  // Disable on mobile, reduced-motion, or low-CPU devices — pure CSS gradient stays.
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const narrow = window.innerWidth < 900;
    const lowCPU = (navigator as any).hardwareConcurrency
      ? (navigator as any).hardwareConcurrency <= 4
      : false;
    if (reduced || narrow || lowCPU) setEnabled(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationId = 0;
    let running = true;
    const stars: Star[] = [];
    const STAR_COUNT = 24;
    const MAX_DIST = 90;
    const MAX_DIST_SQ = MAX_DIST * MAX_DIST;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const W = () => canvas.width / dpr;
    const H = () => canvas.height / dpr;

    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * W(),
        y: Math.random() * H(),
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        radius: Math.random() * 1.3 + 0.3,
        opacity: Math.random() * 0.35 + 0.2,
      });
    }

    let lastTime = 0;
    const FPS_INTERVAL = 1000 / 15; // cap at 15fps — invisible to the eye, ~half the work

    const draw = (timestamp: number) => {
      if (!running) return;
      animationId = requestAnimationFrame(draw);
      const delta = timestamp - lastTime;
      if (delta < FPS_INTERVAL) return;
      lastTime = timestamp - (delta % FPS_INTERVAL);

      const w = W(), h = H();
      ctx.clearRect(0, 0, w, h);

      const r = 180, g = 185, b = 195;

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < 0 || s.x > w) s.vx *= -1;
        if (s.y < 0 || s.y > h) s.vy *= -1;

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${s.opacity})`;
        ctx.fill();

        for (let j = i + 1; j < stars.length; j++) {
          const s2 = stars[j];
          const dx = s.x - s2.x;
          const dy = s.y - s2.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < MAX_DIST_SQ) {
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s2.x, s2.y);
            ctx.strokeStyle = `rgba(${r},${g},${b},${0.06 * (1 - Math.sqrt(distSq) / MAX_DIST)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    };
    animationId = requestAnimationFrame(draw);

    // Pause when tab is hidden — saves battery and CPU.
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(animationId);
      } else if (!running) {
        running = true;
        lastTime = 0;
        animationId = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ background: "transparent" }}
      aria-hidden="true"
    />
  );
});

ConstellationBackground.displayName = "ConstellationBackground";

export default ConstellationBackground;
