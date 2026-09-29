import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { engine } from '../audio/engine'
import { onRawMove } from '../input/trackpad'
import { keyLabel } from '../input/bindings'
import { useStore, type Gesture } from '../store'
import { BeatDots } from './HUD'
import { EASE } from './motion'

const STEPS = ['Gesture', 'Calibrate', 'The cut'] as const

export function Onboarding() {
  const [step, setStep] = useState(0)
  const set = useStore((s) => s.set)
  const setSettings = useStore((s) => s.setSettings)

  const finish = () => {
    setSettings({ onboarded: true })
    set({ phase: 'session' })
  }
  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : finish())

  useEffect(() => {
    engine.cue()
  }, [])

  return (
    <motion.div className="onboard-wrap" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
    <motion.aside
      className="paper onboard"
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE, delay: 0.4 } }}
      exit={{ opacity: 0, x: -16, transition: { duration: 0.2 } }}
      aria-labelledby="onboard-title"
    >
      <div className="onboard-top">
        <span className="mono">
          {String(step + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
        </span>
        <div className="onboard-steps" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className={i <= step ? 'on' : ''} />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
          className="onboard-body"
        >
          {step === 0 && <GestureStep />}
          {step === 1 && <CalibrateStep />}
          {step === 2 && <CutStep />}
        </motion.div>
      </AnimatePresence>

      <div className="onboard-foot">
        <button className="btn btn-ghost" onClick={finish}>
          Skip setup
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          {step > 0 && (
            <button className="btn btn-line" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <button className="btn btn-ink" onClick={next}>
            {step === STEPS.length - 1 ? 'Start session' : 'Continue'}
          </button>
        </div>
      </div>

      <style>{`
        .onboard-wrap { position: fixed; inset: 0; display: flex; align-items: center; padding: 16px var(--gutter); pointer-events: none; }
        .onboard { pointer-events: auto; width: 400px; max-height: 100%; overflow-y: auto; padding: 22px 24px 18px; display: grid; gap: 16px; }
        .onboard-top { display: flex; justify-content: space-between; align-items: center; color: var(--muted); }
        .onboard-steps { display: flex; gap: 4px; }
        .onboard-steps span { width: 22px; height: 2px; background: var(--faint); }
        .onboard-steps span.on { background: var(--ink); }
        .onboard-body { display: grid; gap: 12px; min-height: 300px; align-content: start; }
        .onboard h2 { margin: 0; font-size: 36px; line-height: 1.02; font-weight: 400; }
        .onboard p { margin: 0; }
        .onboard-foot { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--hair); padding-top: 14px; }
        .tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .tile { text-align: left; border: 1px solid var(--hair); border-radius: var(--r); padding: 12px; display: grid; gap: 8px; transition: border-color .2s; }
        .tile[aria-pressed='true'] { border-color: var(--ink); box-shadow: inset 0 0 0 1px var(--ink); }
        .tile .serif { font-size: 21px; }
        .tile svg { width: 100%; height: 56px; }
        .dial-wrap { display: flex; gap: 18px; align-items: center; }
        .readout { font-family: var(--serif); font-size: 44px; line-height: 1; }
        .hitrow { display: flex; gap: 6px; min-height: 22px; flex-wrap: wrap; }
      `}</style>
    </motion.aside>
    </motion.div>
  )
}

function GestureStep() {
  const gesture = useStore((s) => s.settings.gesture)
  const setSettings = useStore((s) => s.setSettings)
  const pick = (g: Gesture) => setSettings({ gesture: g })
  return (
    <>
      <h2 className="serif" id="onboard-title">
        How will you
        <br />
        <em>hold the record?</em>
      </h2>
      <p className="body">Both work. You can switch any time in Settings.</p>
      <div className="tiles" role="group" aria-label="Gesture">
        <button className="tile" aria-pressed={gesture === 'swipe'} onClick={() => pick('swipe')}>
          <SwipeHint />
          <span className="serif">Swipe</span>
          <span className="body" style={{ fontSize: 12 }}>
            Two fingers, like scrolling. Stop moving to hold; flick and lift to let go.
          </span>
        </button>
        <button className="tile" aria-pressed={gesture === 'drag'} onClick={() => pick('drag')}>
          <DragHint />
          <span className="serif">Press &amp; drag</span>
          <span className="body" style={{ fontSize: 12 }}>
            Press the pad = hand on the record. Release to let it spin. Most precise.
          </span>
        </button>
      </div>
    </>
  )
}

function SwipeHint() {
  return (
    <svg viewBox="0 0 120 70" aria-hidden>
      <rect x="20" y="6" width="80" height="58" rx="6" fill="none" stroke="currentColor" strokeOpacity=".25" />
      <g>
        <animateTransform attributeName="transform" type="translate" values="0 10; 0 -10; 0 10" dur="1.6s" repeatCount="indefinite" />
        <circle cx="52" cy="35" r="5" fill="var(--ink)" />
        <circle cx="68" cy="35" r="5" fill="var(--ink)" />
      </g>
    </svg>
  )
}
function DragHint() {
  return (
    <svg viewBox="0 0 120 70" aria-hidden>
      <rect x="20" y="6" width="80" height="58" rx="6" fill="none" stroke="currentColor" strokeOpacity=".25" />
      <g>
        <animateTransform attributeName="transform" type="translate" values="0 10; 0 -10; 0 10" dur="1.6s" repeatCount="indefinite" />
        <circle cx="60" cy="35" r="9" fill="none" stroke="var(--accent)" strokeWidth="1.2">
          <animate attributeName="r" values="6;10;6" dur="1.6s" repeatCount="indefinite" />
        </circle>
        <circle cx="60" cy="35" r="5" fill="var(--ink)" />
      </g>
    </svg>
  )
}

function CalibrateStep() {
  const gesture = useStore((s) => s.settings.gesture)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const [acc, setAcc] = useState(0)
  const [saved, setSaved] = useState(false)
  const accRef = useRef(0)
  const ppt = gesture === 'swipe' ? settings.swipePxPerTurn : settings.dragPxPerTurn

  useEffect(() => {
    const off = onRawMove((px) => {
      accRef.current += px
      setAcc(accRef.current)
      setSaved(false)
    })
    return () => {
      off()
    }
  }, [])

  const turns = acc / ppt
  const canSet = Math.abs(acc) > 150
  const save = () => {
    const key = gesture === 'swipe' ? 'swipePxPerTurn' : 'dragPxPerTurn'
    setSettings({ [key]: Math.round(Math.abs(acc)), invert: acc < 0 ? !settings.invert : settings.invert })
    setSaved(true)
    accRef.current = 0
    setAcc(0)
    engine.cue()
  }
  const reset = () => {
    accRef.current = 0
    setAcc(0)
    engine.cue()
  }

  return (
    <>
      <h2 className="serif" id="onboard-title">
        One full <em>turn</em>
      </h2>
      <p className="body">
        Watch the orange sticker on the label. {gesture === 'swipe' ? 'Swipe' : 'Press and drag'} to push the record <strong>forward</strong> until the sticker comes back around to
        the top — one full turn — then set it.
      </p>
      <div className="dial-wrap">
        <Dial turns={turns} />
        <div style={{ display: 'grid', gap: 6 }}>
          <span className="readout">{turns.toFixed(2)}</span>
          <span className="label">turns at current setting</span>
          <span className="mono" style={{ color: 'var(--muted)' }}>
            {Math.round(Math.abs(acc))} px moved
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn btn-ink" onClick={save} disabled={!canSet}>
          Set as one turn
        </button>
        <button className="btn btn-ghost" onClick={reset}>
          Reset
        </button>
        {saved && <span className="label" style={{ color: 'var(--ink)' }}>Saved ✓</span>}
      </div>
      <p className="body" style={{ fontSize: 12 }}>
        Record went the wrong way? Setting it anyway flips the direction for you.
      </p>
    </>
  )
}

function Dial({ turns }: { turns: number }) {
  const a = turns * 360
  return (
    <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden>
      <circle cx="56" cy="56" r="52" fill="#1a1918" />
      <circle cx="56" cy="56" r="40" fill="none" stroke="#2c2b29" strokeWidth="1" />
      <circle cx="56" cy="56" r="30" fill="none" stroke="#2c2b29" strokeWidth="1" />
      <circle cx="56" cy="56" r="18" fill="var(--paper)" />
      <path d="M56 4 v8" stroke="var(--muted)" strokeWidth="1" />
      <g transform={`rotate(${a} 56 56)`}>
        <rect x="54.6" y="12" width="2.8" height="28" rx="1" fill="var(--accent)" />
      </g>
      <circle cx="56" cy="56" r="2" fill="#1a1918" />
    </svg>
  )
}

function CutStep() {
  const faderOpen = useStore((s) => s.faderOpen)
  const faderKey = useStore((s) => s.settings.bindings.fader)
  const [hits, setHits] = useState<('on' | 'early' | 'late')[]>([])
  const prev = useRef(false)

  useEffect(() => {
    if (faderOpen && !prev.current) {
      const b = engine.beatNow()
      const off = b - Math.round(b) // beats
      const ms = (off * 60000) / engine.bpm
      const v: 'on' | 'early' | 'late' = Math.abs(ms) < 70 ? 'on' : ms < 0 ? 'early' : 'late'
      setHits((h) => [...h.slice(-7), v])
    }
    prev.current = faderOpen
  }, [faderOpen])

  const streak = (() => {
    let n = 0
    for (let i = hits.length - 1; i >= 0 && hits[i] === 'on'; i--) n++
    return n
  })()

  return (
    <>
      <h2 className="serif" id="onboard-title">
        The <em>cut</em>
      </h2>
      <p className="body">
        The fader rests closed — silent. Hold <span className="chip">{keyLabel(faderKey)}</span> to let the record through. Tap it on each beat to feel the timing, then
        try it while moving the record.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <BeatDots size={12} />
        <span className={`chip ${faderOpen ? 'is-on' : ''}`}>{faderOpen ? 'Open' : 'Closed'}</span>
      </div>
      <div className="hitrow" aria-live="polite">
        {hits.map((h, i) => (
          <span key={i} className={`chip ${h === 'on' ? 'is-on' : ''}`}>
            {h === 'on' ? 'On beat' : h === 'early' ? 'Early' : 'Late'}
          </span>
        ))}
      </div>
      <p className="serif" style={{ fontSize: 22, minHeight: 28 }}>
        {streak >= 4 ? 'Locked in. You’ve got the cut.' : hits.length ? `${streak} in a row` : ''}
      </p>
    </>
  )
}
