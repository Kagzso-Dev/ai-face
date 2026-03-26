import { motion } from 'framer-motion';

/**
 * 3D face-scan loader shown briefly between page transitions.
 * Uses CSS 3D transforms + Framer Motion.
 */
const PageTransitionLoader = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-dark-900/80 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-5">
        {/* 3D spinning cube / face scanner */}
        <div className="scene" style={{ width: 64, height: 64, perspective: 200 }}>
          <motion.div
            animate={{ rotateY: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            style={{
              width: 64,
              height: 64,
              position: 'relative',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Six cube faces */}
            {[
              { transform: 'rotateY(0deg)   translateZ(32px)', bg: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.5)' },
              { transform: 'rotateY(90deg)  translateZ(32px)', bg: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.5)' },
              { transform: 'rotateY(180deg) translateZ(32px)', bg: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.5)' },
              { transform: 'rotateY(270deg) translateZ(32px)', bg: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.5)' },
              { transform: 'rotateX(90deg)  translateZ(32px)', bg: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)' },
              { transform: 'rotateX(-90deg) translateZ(32px)', bg: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)' },
            ].map((face, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  width: 64,
                  height: 64,
                  transform: face.transform,
                  background: face.bg,
                  border: face.border,
                  borderRadius: 8,
                  backdropFilter: 'blur(2px)',
                }}
              />
            ))}

            {/* Face icon on front face */}
            <div
              style={{
                position: 'absolute',
                width: 64,
                height: 64,
                transform: 'rotateY(0deg) translateZ(33px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ScanIcon />
            </div>
          </motion.div>
        </div>

        {/* Scanning line */}
        <div className="relative w-48 h-1 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 w-12 rounded-full"
            style={{ background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)' }}
            animate={{ x: [0, 144, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <p className="text-blue-400/80 text-xs tracking-widest uppercase animate-pulse">
          Loading…
        </p>
      </div>
    </motion.div>
  );
};

const ScanIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(147,197,253,0.9)" strokeWidth="1.5" strokeLinecap="round">
    {/* corner brackets */}
    <path d="M3 7V4h3" /><path d="M21 7V4h-3" />
    <path d="M3 17v3h3" /><path d="M21 17v3h-3" />
    {/* face dots */}
    <circle cx="9"  cy="10" r="1" fill="rgba(147,197,253,0.9)" stroke="none" />
    <circle cx="15" cy="10" r="1" fill="rgba(147,197,253,0.9)" stroke="none" />
    {/* smile */}
    <path d="M9 15s1 1.5 3 1.5 3-1.5 3-1.5" />
  </svg>
);

export default PageTransitionLoader;
