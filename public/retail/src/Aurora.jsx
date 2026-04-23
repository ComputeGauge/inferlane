// Glossy aurora backdrop — slow drifting gradient blobs on a canvas.
// Honors prefers-reduced-motion (renders a single static frame).

function Aurora({ variant = 'amber', intensity = 1 }) {
  const canvasRef = React.useRef(null);
  const reduced = usePrefersReducedMotion();

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf, running = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const palettes = {
      amber: [
        { r: 245, g: 158, b: 11 },
        { r: 217, g: 70,  b: 47 },
        { r: 139, g: 92,  b: 246 },
        { r: 6,   g: 182, b: 212 },
      ],
      cool: [
        { r: 139, g: 92,  b: 246 },
        { r: 6,   g: 182, b: 212 },
        { r: 16,  g: 185, b: 129 },
        { r: 245, g: 158, b: 11 },
      ],
      purple: [
        { r: 139, g: 92, b: 246 },
        { r: 245, g: 158, b: 11 },
        { r: 236, g: 72, b: 153 },
        { r: 6,   g: 182, b: 212 },
      ],
    };
    const palette = palettes[variant] || palettes.amber;

    const blobs = palette.map((c, i) => ({
      color: c,
      phase: i * 1.7 + Math.random() * 2,
      speed: 0.00004 + Math.random() * 0.00006,
      size: 0.55 + Math.random() * 0.35,
      ax: 0.25 + Math.random() * 0.5,
      ay: 0.15 + Math.random() * 0.4,
    }));

    const draw = (ts) => {
      ctx.clearRect(0, 0, w, h);
      // base dark wash
      const base = ctx.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0, 'rgba(14,14,22,1)');
      base.addColorStop(1, 'rgba(10,10,15,1)');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);

      // blobs
      ctx.globalCompositeOperation = 'screen';
      blobs.forEach((b, i) => {
        const t = reduced ? b.phase : ts * b.speed + b.phase;
        const cx = (0.5 + Math.cos(t) * b.ax * 0.8) * w;
        const cy = (0.4 + Math.sin(t * 1.3) * b.ay) * h;
        const r  = Math.min(w, h) * b.size;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        const { r: R, g: G, b: B } = b.color;
        const a = 0.32 * intensity;
        grad.addColorStop(0, `rgba(${R},${G},${B},${a})`);
        grad.addColorStop(0.5, `rgba(${R},${G},${B},${a * 0.35})`);
        grad.addColorStop(1, `rgba(${R},${G},${B},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';

      // subtle grain
      ctx.fillStyle = 'rgba(255,255,255,0.015)';
      for (let i = 0; i < w * h / 2200; i++) {
        ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
      }
    };

    if (reduced) {
      draw(0);
    } else {
      const loop = (ts) => {
        if (!running) return;
        draw(ts);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); };
  }, [variant, intensity, reduced]);

  return (
    <div className="aurora" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}

// Soft orbiting dots — for step illustrations
function OrbitViz({ color = '#f59e0b', count = 3, speed = 1 }) {
  const reduced = usePrefersReducedMotion();
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    if (reduced) { setT(0.4); return; }
    let raf, start = performance.now();
    const loop = () => {
      setT((performance.now() - start) / 1000 * speed);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced, speed]);
  return (
    <svg viewBox="0 0 160 120" width="100%" height="100%" aria-hidden="true">
      <defs>
        <radialGradient id={`og-${color}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="80" cy="60" rx="55" ry="22" fill="none" stroke={color} strokeOpacity="0.2" strokeDasharray="2 3" />
      <ellipse cx="80" cy="60" rx="36" ry="14" fill="none" stroke={color} strokeOpacity="0.15" strokeDasharray="2 3" />
      <circle cx="80" cy="60" r="18" fill={`url(#og-${color})`} opacity="0.5" />
      <circle cx="80" cy="60" r="8" fill={color} />
      <circle cx="80" cy="60" r="8" fill="#fff" opacity="0.25" />
      {Array.from({ length: count }).map((_, i) => {
        const angle = t + (i * Math.PI * 2) / count;
        const x = 80 + Math.cos(angle) * 55;
        const y = 60 + Math.sin(angle) * 22;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="10" fill={color} opacity="0.2" />
            <circle cx={x} cy={y} r="4" fill={color} />
            <circle cx={x} cy={y} r="4" fill="#fff" opacity="0.3" />
          </g>
        );
      })}
    </svg>
  );
}

// Waveform-style breathing illustration
function WaveViz({ color = '#f59e0b' }) {
  const reduced = usePrefersReducedMotion();
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    if (reduced) { setT(1.4); return; }
    let raf, s = performance.now();
    const loop = () => { setT((performance.now() - s) / 1000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);
  const bars = 21;
  return (
    <svg viewBox="0 0 200 120" width="100%" height="100%" aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => {
        const x = 10 + i * 9;
        const h = 12 + Math.abs(Math.sin(t * 1.4 + i * 0.38)) * (28 + Math.sin(i * 0.6) * 16);
        return (
          <rect
            key={i}
            x={x} y={60 - h/2} width="5" height={h}
            rx="2.5"
            fill={color}
            opacity={0.25 + 0.7 * Math.abs(Math.sin(t + i * 0.3))}
          />
        );
      })}
    </svg>
  );
}

// Shield/lock glyph that gently rotates
function ShieldViz({ color = '#10b981' }) {
  const reduced = usePrefersReducedMotion();
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    if (reduced) return;
    let raf, s = performance.now();
    const loop = () => { setT((performance.now() - s) / 1000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);
  return (
    <svg viewBox="0 0 160 140" width="100%" height="100%" aria-hidden="true">
      <defs>
        <linearGradient id="sh-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {/* orbiting dots */}
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = t * 0.6 + i * (Math.PI * 2 / 5);
        const cx = 80 + Math.cos(angle) * 55;
        const cy = 70 + Math.sin(angle) * 30;
        return <circle key={i} cx={cx} cy={cy} r="2.5" fill={color} opacity="0.6" />;
      })}
      <path
        d="M80 15 L128 32 V72 C128 98 104 118 80 128 C56 118 32 98 32 72 V32 Z"
        fill="url(#sh-grad)"
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity="0.6"
      />
      <circle cx="80" cy="68" r="12" fill={color} opacity="0.2" />
      <rect x="74" y="74" width="12" height="14" rx="2" fill={color} />
      <path d="M77 74 V68 A3 3 0 0 1 83 68 V74" stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

// 3D-ish stack of servers / coin-like visuals for earn
function StackViz({ color = '#f59e0b' }) {
  const reduced = usePrefersReducedMotion();
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    if (reduced) return;
    let raf, s = performance.now();
    const loop = () => { setT((performance.now() - s) / 1000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);
  // floating coins
  return (
    <svg viewBox="0 0 180 140" width="100%" height="100%" aria-hidden="true">
      <defs>
        <linearGradient id="coin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      {/* base disk */}
      <ellipse cx="90" cy="110" rx="65" ry="9" fill={color} opacity="0.1" />
      {[0, 1, 2].map((i) => {
        const y = 90 - i * 14 + Math.sin(t * 1.2 + i) * 2;
        return (
          <g key={i}>
            <ellipse cx="90" cy={y + 6} rx="40" ry="8" fill="#000" opacity="0.25" />
            <ellipse cx="90" cy={y} rx="40" ry="10" fill="url(#coin)" stroke="#fcd34d" strokeWidth="0.8" />
            <text x="90" y={y + 3} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontWeight="600" fontSize="11" fill="#1a0e00">kT</text>
          </g>
        );
      })}
      {/* floating sparkles */}
      {[[30, 40], [150, 50], [140, 25], [25, 70]].map(([x, y], i) => {
        const a = 0.3 + Math.abs(Math.sin(t * 2 + i)) * 0.7;
        return <circle key={i} cx={x} cy={y} r="1.8" fill={color} opacity={a} />;
      })}
    </svg>
  );
}

Object.assign(window, { Aurora, OrbitViz, WaveViz, ShieldViz, StackViz });
