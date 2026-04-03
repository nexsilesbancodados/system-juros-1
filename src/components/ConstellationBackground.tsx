import { useEffect, useRef, memo } from "react";

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    const stars: Star[] = [];
    const STAR_COUNT = 30;
    const MAX_DIST = 100;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        radius: Math.random() * 1.5 + 0.3,
        opacity: Math.random() * 0.4 + 0.2,
      });
    }

    let lastTime = 0;
    const FPS_INTERVAL = 1000 / 20; // cap at 20fps

    const draw = (timestamp: number) => {
      animationId = requestAnimationFrame(draw);
      const delta = timestamp - lastTime;
      if (delta < FPS_INTERVAL) return;
      lastTime = timestamp - (delta % FPS_INTERVAL);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const r = 180, g = 185, b = 195;

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < 0 || s.x > canvas.width) s.vx *= -1;
        if (s.y < 0 || s.y > canvas.height) s.vy *= -1;

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${s.opacity})`;
        ctx.fill();

        for (let j = i + 1; j < stars.length; j++) {
          const s2 = stars[j];
          const dx = s.x - s2.x;
          const dy = s.y - s2.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < MAX_DIST * MAX_DIST) {
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

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0"
      style={{ background: "linear-gradient(160deg, hsl(0 0% 4%), hsl(0 0% 7%), hsl(0 0% 4%))" }}
    />
  );
});

ConstellationBackground.displayName = "ConstellationBackground";

export default ConstellationBackground;
