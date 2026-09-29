import { motion } from 'motion/react'
import { useStore } from '../store'

export function Loading({ modelProgress }: { modelProgress: number }) {
  const load = useStore((s) => s.load)
  const label = useStore((s) => s.loadLabel)
  const p = Math.min(1, load * 0.8 + modelProgress * 0.2)
  return (
    <motion.div
      className="loading"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } }}
      role="status"
      aria-label={`Loading, ${Math.round(p * 100)} percent`}
    >
      <div className="loading-inner">
        <div className="serif loading-mark">
          <em>Needle</em>
        </div>
        <div className="loading-bar">
          <motion.div className="loading-fill" animate={{ scaleX: p }} transition={{ duration: 0.4, ease: 'easeOut' }} />
        </div>
        <div className="label">{label}</div>
      </div>
      <style>{`
        .loading { position: fixed; inset: 0; background: var(--scene); display: grid; place-items: center; z-index: 50; }
        .loading-inner { display: grid; justify-items: center; gap: 22px; }
        .loading-mark { font-size: 76px; line-height: 1; color: var(--ink); }
        .loading-bar { width: 220px; height: 1px; background: var(--faint); overflow: hidden; }
        .loading-fill { height: 100%; background: var(--ink); transform-origin: left; transform: scaleX(0); }
      `}</style>
    </motion.div>
  )
}
