import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { engine } from '../audio/engine'
import { toggleRecord } from '../actions'
import { keyLabel, ACTION_LABEL, type Action } from '../input/bindings'
import { useStore } from '../store'
import { fade, rise } from './motion'
import { WaveStrip } from './WaveStrip'
import { FEATURES } from '../config'

export function BeatDots({ size = 7 }: { size?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    let last = -1
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const b = Math.floor(engine.beatNow()) % 4
      if (b === last || !ref.current) return
      last = b
      Array.from(ref.current.children).forEach((c, i) => c.classList.toggle('on', i === b))
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div ref={ref} className="beatdots" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} style={{ width: size, height: size }} />
      ))}
      <style>{`
        .beatdots { display: inline-flex; gap: 6px; align-items: center; }
        .beatdots span { border-radius: 50%; border: 1px solid var(--ink); transition: background .08s; }
        .beatdots span.on { background: var(--ink); }
        .beatdots span:first-child.on { background: var(--accent); border-color: var(--accent); }
      `}</style>
    </div>
  )
}

function RecTimer({ since }: { since: number }) {
  const [t, setT] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setT((performance.now() - since) / 1000), 250)
    return () => clearInterval(id)
  }, [since])
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return (
    <span className="mono">
      {m}:{String(s).padStart(2, '0')}
    </span>
  )
}

function Key({ a }: { a: Action }) {
  const code = useStore((s) => s.settings.bindings[a])
  return <span className="chip">{keyLabel(code)}</span>
}

function HelpCard() {
  const gesture = useStore((s) => s.settings.gesture)
  const rows = (['fader', 'faderA', 'faderB', 'hamster', 'cue', 'camera', 'motor', 'record', 'crate', 'prevSample', 'nextSample'] as Action[]).filter(
    (a) => a !== 'record' || FEATURES.recording,
  )
  return (
    <motion.div className="paper help" variants={fade} initial="hidden" animate="show" exit="exit">
      <div className="help-head">
        <span className="serif" style={{ fontSize: 26 }}>
          Keys
        </span>
        <span className="label">? to close</span>
      </div>
      <div className="help-row">
        <span className="body">{gesture === 'swipe' ? 'Two-finger swipe' : 'Press & drag'}</span>
        <span className="body" style={{ color: 'var(--ink)' }}>
          Move the record
        </span>
      </div>
      {rows.map((a) => (
        <div key={a} className="help-row">
          <Key a={a} />
          <span className="body">{ACTION_LABEL[a]}</span>
        </div>
      ))}
      <div className="help-row">
        <span className="chip">1–4</span>
        <span className="body">Change beat</span>
      </div>
      <div className="help-row">
        <span className="chip">Esc</span>
        <span className="body">Settings</span>
      </div>
    </motion.div>
  )
}

export function HUD() {
  const beats = useStore((s) => s.beats)
  const samples = useStore((s) => s.samples)
  const beatId = useStore((s) => s.settings.beatId)
  const sampleId = useStore((s) => s.settings.sampleId)
  const faderOpen = useStore((s) => s.faderOpen)
  const hamster = useStore((s) => s.hamster)
  const motorOn = useStore((s) => s.motorOn)
  const recording = useStore((s) => s.recording)
  const recStartedAt = useStore((s) => s.recStartedAt)
  const take = useStore((s) => s.take)
  const help = useStore((s) => s.help)
  const gesture = useStore((s) => s.settings.gesture)
  const set = useStore((s) => s.set)
  const [hints, setHints] = useState(true)

  useEffect(() => {
    const id = setTimeout(() => setHints(false), 10000)
    return () => clearTimeout(id)
  }, [])

  const beat = beats.find((b) => b.id === beatId)
  const sample = samples.find((s) => s.id === sampleId)
  const beatIndex = beats.filter((b) => b.playable).findIndex((b) => b.id === beatId)

  return (
    <motion.div className="hud" initial="hidden" animate="show" exit="exit" variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.5 } } }}>
      <motion.div className="hud-tl veil" variants={rise}>
        <div className="label">Now playing{beatIndex >= 0 && ` · ${beatIndex + 1}`}</div>
        <div className="serif hud-beat">{beat?.name ?? '—'}</div>
        <div className="hud-bpm">
          <span className="serif hud-bpm-n">{beat?.bpm ?? '--'}</span>
          <span className="label">BPM</span>
          <BeatDots />
        </div>
      </motion.div>

      <motion.nav className="hud-tr veil" variants={rise} aria-label="Session">
        <button className="btn btn-ghost" onClick={() => set({ panel: 'crate', help: false })}>
          Crate <Key a="crate" />
        </button>
        <button className="btn btn-ghost" onClick={() => set({ panel: 'settings', help: false })}>
          Settings <span className="chip">Esc</span>
        </button>
        {FEATURES.recording && (
        <button
          className={`btn btn-line rec ${recording ? 'is-rec' : ''}`}
          onClick={() => toggleRecord()}
          disabled={!!take}
          aria-pressed={recording}
          aria-label={recording ? 'Stop recording' : 'Start recording'}
        >
          <span className="rec-dot" />
          {recording ? <RecTimer since={recStartedAt} /> : 'Rec'}
          <Key a="record" />
        </button>
        )}
      </motion.nav>

      <AnimatePresence>{help && <HelpCard key="help" />}</AnimatePresence>

      <motion.div className="hud-bottom" variants={rise}>
        <AnimatePresence>
          {hints && !help && (
            <motion.div className="hints veil" variants={fade} initial="hidden" animate="show" exit="exit">
              <span>
                <span className="chip">{gesture === 'swipe' ? 'Two-finger swipe' : 'Press & drag'}</span> scratch
              </span>
              <span>
                <Key a="fader" /> cut in
              </span>
              <span>
                <Key a="cue" /> back to cue
              </span>
              <span>
                <Key a="camera" /> room view
              </span>
              <span>
                <Key a="crate" /> crate
              </span>
              <span>
                <Key a="help" /> all keys
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="paper strip">
          <div className="strip-info">
            <div className="label">Sample</div>
            <div className="serif strip-name">{sample?.name ?? '—'}</div>
            <div className="strip-state">
              <span className={`chip ${faderOpen ? 'is-on' : ''}`} aria-label={faderOpen ? 'Fader open' : 'Fader closed'}>
                {faderOpen ? 'Open' : 'Closed'}
              </span>
              {hamster && <span className="chip is-on">Hamster</span>}
              <span className={`chip ${motorOn ? '' : 'is-on'}`}>{motorOn ? 'Motor' : 'Motor off'}</span>
            </div>
          </div>
          <div className="strip-canvas">
            <WaveStrip />
          </div>
        </div>
      </motion.div>

      <style>{`
        .hud { position: fixed; inset: 0; pointer-events: none; }
        .hud > * { pointer-events: auto; }
        .hud-tl { position: absolute; top: 16px; left: var(--gutter); padding: 12px 18px 12px 16px; }
        .veil { background: rgba(243,238,227,0.86); border: 1px solid var(--hair); border-radius: var(--r); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
        .hud-beat { font-size: 30px; line-height: 1.05; margin-top: 4px; }
        .hud-bpm { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
        .hud-bpm-n { font-size: 22px; }
        .hud-tr { position: absolute; top: 16px; right: var(--gutter); display: flex; gap: 16px; align-items: center; padding: 6px 6px 6px 16px; border-radius: 999px; }
        .hud-tr .btn-ghost { gap: 8px; font-size: 11px; }
        .rec { height: 34px; padding: 0 12px 0 12px; gap: 9px; font-size: 11px; }
        .rec-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
        .rec.is-rec { border-color: var(--accent); color: var(--accent); }
        .rec.is-rec .rec-dot { animation: recpulse 1s infinite; }
        @keyframes recpulse { 50% { opacity: .25 } }
        .hud-bottom { position: absolute; left: var(--gutter); right: var(--gutter); bottom: var(--gutter); display: grid; gap: 10px; }
        .hints { justify-self: center; display: flex; gap: 20px; justify-content: center; font-size: 11.5px; color: var(--ink-2); padding: 6px 16px 6px 8px; border-radius: 999px; }
        .hints > span { display: inline-flex; align-items: center; gap: 7px; }
        .strip { display: grid; grid-template-columns: 200px 1fr; align-items: stretch; background: rgba(243,238,227,0.9); backdrop-filter: blur(6px); }
        .strip-info { padding: 16px 18px; border-right: 1px solid var(--hair); display: flex; flex-direction: column; gap: 4px; }
        .strip-name { font-size: 28px; line-height: 1.05; }
        .strip-state { display: flex; gap: 6px; margin-top: auto; flex-wrap: wrap; }
        .strip-canvas { min-width: 0; }
        .help { position: absolute; right: var(--gutter); top: 72px; width: 300px; padding: 18px 20px; display: grid; gap: 9px; }
        .help-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
        .help-row { display: grid; grid-template-columns: 112px 1fr; align-items: center; gap: 10px; }
        .help-row .chip { justify-self: start; }
      `}</style>
    </motion.div>
  )
}
