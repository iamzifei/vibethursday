/**
 * The welcome after "I've transferred" (2026-10-12): a big tick and a short
 * burst of confetti, CSS only, so it works in WeChat's browser with or without
 * script. Positions come from a fixed formula, not Math.random, so the server
 * and the browser draw the same thing. Anyone who has asked for reduced motion
 * gets the tick without the falling paper.
 */
const COLORS = ["#c6ff3d", "#3ddcff", "#f4f5f2", "#ffd23d"];

export function Celebration() {
  const pieces = Array.from({ length: 48 }, (_, i) => ({
    left: (i * 37) % 100,
    delay: ((i * 53) % 90) / 100,
    duration: 2.4 + ((i * 29) % 14) / 10,
    size: 8 + ((i * 17) % 8),
    color: COLORS[i % COLORS.length],
    tilt: (i * 47) % 360,
  }));

  return (
    <div className="celebrate" aria-hidden="true">
      <style>{`
        .celebrate { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 50; }
        .celebrate i { position: absolute; top: -24px; display: block; border-radius: 2px; opacity: 0;
          animation-name: vt-fall; animation-timing-function: cubic-bezier(.25,.6,.4,1); animation-fill-mode: forwards; }
        @keyframes vt-fall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg); }
          85% { opacity: 1; }
          100% { opacity: 0; transform: translateY(105vh) rotate(720deg); }
        }
        .tick { width: 96px; height: 96px; border-radius: 50%; background: #c6ff3d; color: #0a0b0d;
          display: grid; place-items: center; font-size: 56px; font-weight: 900;
          animation: vt-pop .6s cubic-bezier(.2,1.6,.4,1) both; }
        @keyframes vt-pop { 0% { transform: scale(0); } 100% { transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .celebrate { display: none; } .tick { animation: none; } }
      `}</style>
      {pieces.map((p, i) => (
        <i
          key={i}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.6,
            background: p.color,
            transform: `rotate(${p.tilt}deg)`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
