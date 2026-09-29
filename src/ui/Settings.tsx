import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { engine } from '../audio/engine'
import { ACTION_LABEL, DEFAULT_BINDINGS, REBINDABLE, keyLabel, type Action } from '../input/bindings'
import { captureNextKey } from '../input/keyboard'
import { DEFAULT_SETTINGS, useStore, type Settings as S } from '../store'
import { sheet } from './motion'
import { SheetStyles } from './Crate'

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} aria-pressed={value === v} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  )
}

function Range({ value, min, max, step, onChange, format, label }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string; label: string }) {
  return (
    <div className="field-range">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
      <span className="mono">{format(value)}</span>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  )
}

const pct = (v: number) => `${Math.round(v * 100)}%`

export function Settings() {
  const s = useStore((st) => st.settings)
  const setSettings = useStore((st) => st.setSettings)
  const set = useStore((st) => st.set)
  const phase = useStore((st) => st.phase)
  const [listening, setListening] = useState<Action | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const update = (p: Partial<S>) => {
    setSettings(p)
    if ('volume' in p || 'beatLevel' in p || 'sampleLevel' in p) engine.applyLevels()
    if ('motorStartMs' in p) engine.applyMotor()
  }

  useEffect(() => () => captureNextKey(null), [])

  const pptKey = s.gesture === 'swipe' ? 'swipePxPerTurn' : 'dragPxPerTurn'
  const base = s.gesture === 'swipe' ? DEFAULT_SETTINGS.swipePxPerTurn : DEFAULT_SETTINGS.dragPxPerTurn
  const sens = base / s[pptKey]

  const rebind = (a: Action) => {
    setListening(a)
    captureNextKey((code) => {
      setListening(null)
      if (!code) return
      const b = { ...s.bindings }
      // swap if the key is taken
      const clash = (Object.keys(b) as Action[]).find((k) => b[k] === code)
      if (clash) b[clash] = b[a]
      b[a] = code
      setSettings({ bindings: b })
    })
  }

  return (
    <motion.aside className="paper sheet sheet-right" variants={sheet('right')} initial="hidden" animate="show" exit="exit" aria-label="Settings">
      <header className="sheet-head">
        <h2 className="serif">Settings</h2>
        <button className="btn btn-ghost" onClick={() => set({ panel: null })} aria-label="Close settings">
          Close <span className="chip">Esc</span>
        </button>
      </header>
      <div className="sheet-scroll">
        <section className="sec">
          <h3 className="label">Control</h3>
          <Field label="Gesture" hint={s.gesture === 'swipe' ? 'Two-finger swipe. Flick and lift to release.' : 'Press = hand on record. Release lets it spin.'}>
            <Seg
              label="Gesture"
              value={s.gesture}
              options={[
                ['swipe', 'Swipe'],
                ['drag', 'Press & drag'],
              ]}
              onChange={(v) => update({ gesture: v })}
            />
          </Field>
          <Field label="Sensitivity">
            <Range
              label="Sensitivity"
              value={Math.round(sens * 100) / 100}
              min={0.4}
              max={2.5}
              step={0.05}
              onChange={(v) => update({ [pptKey]: Math.round(base / v) } as Partial<S>)}
              format={(v) => `${v.toFixed(2)}×`}
            />
          </Field>
          <Field label="Reverse direction">
            <Seg
              label="Reverse direction"
              value={s.invert ? 'on' : 'off'}
              options={[
                ['off', 'Off'],
                ['on', 'On'],
              ]}
              onChange={(v) => update({ invert: v === 'on' })}
            />
          </Field>
          {phase === 'session' && (
            <Field label="Calibrate" hint="Re-run the three-step setup.">
              <button
                className="btn btn-line"
                style={{ height: 30 }}
                onClick={() => {
                  set({ panel: null, phase: 'onboarding' })
                }}
              >
                Run setup
              </button>
            </Field>
          )}
        </section>

        <section className="sec">
          <h3 className="label">Sound</h3>
          <Field label="Fader curve" hint={s.faderCurve === 'cut' ? 'Sharp cut — instant on/off, like a battle mixer.' : 'Smooth — a short fade in and out.'}>
            <Seg
              label="Fader curve"
              value={s.faderCurve}
              options={[
                ['cut', 'Sharp'],
                ['smooth', 'Smooth'],
              ]}
              onChange={(v) => update({ faderCurve: v })}
            />
          </Field>
          <Field label="Motor start">
            <Range label="Motor start time" value={s.motorStartMs} min={20} max={600} step={10} onChange={(v) => update({ motorStartMs: v })} format={(v) => `${v}ms`} />
          </Field>
          <Field label="Master">
            <Range label="Master volume" value={s.volume} min={0} max={1} step={0.01} onChange={(v) => update({ volume: v })} format={pct} />
          </Field>
          <Field label="Beat">
            <Range label="Beat level" value={s.beatLevel} min={0} max={1} step={0.01} onChange={(v) => update({ beatLevel: v })} format={pct} />
          </Field>
          <Field label="Scratch">
            <Range label="Scratch level" value={s.sampleLevel} min={0} max={1} step={0.01} onChange={(v) => update({ sampleLevel: v })} format={pct} />
          </Field>
        </section>

        <section className="sec">
          <h3 className="label">View</h3>
          <Field label="Camera">
            <Seg
              label="Camera"
              value={s.camera}
              options={[
                ['deck', 'Deck'],
                ['room', 'Room'],
              ]}
              onChange={(v) => update({ camera: v })}
            />
          </Field>
          <Field label="Reduce motion" hint="Stops camera sway, tilt-shift blur and beat-pulsing props.">
            <Seg
              label="Reduce motion"
              value={s.reduceMotion ? 'on' : 'off'}
              options={[
                ['off', 'Off'],
                ['on', 'On'],
              ]}
              onChange={(v) => update({ reduceMotion: v === 'on' })}
            />
          </Field>
          <Field label="Quality" hint="Low turns off soft contact shadows and blur — try it if the room stutters.">
            <Seg
              label="Quality"
              value={s.quality}
              options={[
                ['high', 'High'],
                ['low', 'Low'],
              ]}
              onChange={(v) => update({ quality: v })}
            />
          </Field>
        </section>

        <section className="sec">
          <h3 className="label">Keys</h3>
          {REBINDABLE.map((a) => (
            <div className="field" key={a}>
              <span className="field-label">{ACTION_LABEL[a]}</span>
              <button className={`chip ${listening === a ? 'is-on' : ''}`} style={{ minWidth: 64, height: 26, cursor: 'pointer' }} onClick={() => rebind(a)} aria-label={`Change key for ${ACTION_LABEL[a]}, currently ${keyLabel(s.bindings[a])}`}>
                {listening === a ? 'Press a key…' : keyLabel(s.bindings[a])}
              </button>
            </div>
          ))}
          <div className="field">
            <span className="field-hint" style={{ marginTop: 0 }}>
              1–4 pick a beat · Esc opens settings — these are fixed.
            </span>
          </div>
        </section>

        <section className="sec" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {!confirmReset ? (
            <button className="btn btn-line" onClick={() => setConfirmReset(true)}>
              Reset to defaults
            </button>
          ) : (
            <>
              <span className="body">Reset every setting?</span>
              <button
                className="btn btn-ink"
                onClick={() => {
                  setSettings({ ...DEFAULT_SETTINGS, onboarded: true, beatId: s.beatId, sampleId: s.sampleId, bindings: DEFAULT_BINDINGS })
                  engine.applyLevels()
                  engine.applyMotor()
                  setConfirmReset(false)
                }}
              >
                Reset
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </>
          )}
        </section>
      </div>
      <SheetStyles />
    </motion.aside>
  )
}
