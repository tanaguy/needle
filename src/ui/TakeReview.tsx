import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { engine } from '../audio/engine'
import { encodeWav, peaks } from '../audio/wav'
import { useStore, type Take } from '../store'
import { UI } from '../palette'
import { EASE } from './motion'

let takeNo = 0

// take arrives as a prop so the exit animation keeps its data after the store clears it
export function TakeReview({ take }: { take: Take }) {
  const set = useStore((s) => s.set)
  const [n] = useState(() => ++takeNo)
  const [playing, setPlaying] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const player = useRef<{ stop: () => void; startedAt: number } | null>(null)
  const head = useRef<HTMLDivElement>(null)

  useEffect(() => {
    engine.pauseBeat(true)
    return () => {
      player.current?.stop()
      engine.pauseBeat(false)
    }
  }, [])

  useEffect(() => {
    const cv = canvas.current!
    const dpr = Math.min(devicePixelRatio || 1, 2)
    const w = cv.clientWidth
    const h = cv.clientHeight
    cv.width = w * dpr
    cv.height = h * dpr
    const g = cv.getContext('2d')!
    g.scale(dpr, dpr)
    const pk = peaks(take.l, Math.floor(w / 2))
    g.fillStyle = UI.ink
    for (let i = 0; i < pk.length; i++) {
      const a = Math.max(0.5, pk[i] * (h / 2 - 2))
      g.fillRect(i * 2, h / 2 - a, 1, a * 2)
    }
  }, [take])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const p = player.current
      if (!p || !head.current || !engine.ctx) return
      const f = Math.min(1, (engine.ctx.currentTime - p.startedAt) / take.duration)
      head.current.style.transform = `translateX(${f * 100}%)`
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [playing, take.duration])

  const toggle = () => {
    if (playing) {
      player.current?.stop()
      player.current = null
      setPlaying(false)
      return
    }
    player.current = engine.playBuffer(take.l, take.r, take.sampleRate, () => {
      player.current = null
      setPlaying(false)
    })
    setPlaying(true)
  }

  const download = () => {
    const blob = encodeWav(take.l, take.r, take.sampleRate)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const d = new Date()
    a.href = url
    a.download = `needle-take-${String(n).padStart(2, '0')}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.wav`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const close = () => set({ take: null })
  const mm = Math.floor(take.duration / 60)
  const ss = (take.duration % 60).toFixed(1).padStart(4, '0')

  return (
    <motion.div
      className="take-wrap"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.25 } }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
    >
      <motion.section
        className="paper take"
        role="dialog"
        aria-modal="true"
        aria-labelledby="take-title"
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1, transition: { duration: 0.35, ease: EASE } }}
        exit={{ y: 8, opacity: 0 }}
      >
        <header className="take-head">
          <div>
            <div className="label">Take review</div>
            <h2 className="serif" id="take-title">
              Take {String(n).padStart(2, '0')}
            </h2>
          </div>
          <span className="mono" style={{ color: 'var(--muted)' }}>
            {mm}:{ss}
          </span>
        </header>
        <div className="take-wave">
          <canvas ref={canvas} />
          <div className="take-head-line" ref={head} style={{ opacity: playing ? 1 : 0 }} />
        </div>
        <footer className="take-foot">
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ink" onClick={toggle} autoFocus>
              {playing ? 'Pause' : 'Play'}
            </button>
            <button className="btn btn-line" onClick={download}>
              Download .wav
            </button>
          </div>
          {!confirm ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost" onClick={() => setConfirm(true)}>
                Discard
              </button>
              <button className="btn btn-ghost" onClick={close} style={{ color: 'var(--ink)' }}>
                Keep playing
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="body">Discard this take?</span>
              <button className="btn btn-ghost" style={{ color: 'var(--accent)' }} onClick={close}>
                Discard
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </div>
          )}
        </footer>
      </motion.section>
      <style>{`
        .take-wrap { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(27,26,23,0.18); z-index: 20; }
        .take { width: min(620px, calc(100vw - 48px)); padding: 22px 24px; display: grid; gap: 18px; }
        .take-head { display: flex; justify-content: space-between; align-items: flex-end; }
        .take-head h2 { margin: 2px 0 0; font-size: 38px; font-weight: 400; line-height: 1; }
        .take-wave { position: relative; height: 88px; border-top: 1px solid var(--hair); border-bottom: 1px solid var(--hair); padding: 8px 0; }
        .take-wave canvas { width: 100%; height: 100%; display: block; }
        .take-head-line { position: absolute; top: 0; bottom: 0; left: 0; right: 0; pointer-events: none; }
        .take-head-line::after { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 1.5px; background: var(--accent); }
        .take-foot { display: flex; justify-content: space-between; align-items: center; }
      `}</style>
    </motion.div>
  )
}
