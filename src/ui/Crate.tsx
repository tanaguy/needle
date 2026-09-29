import { motion } from 'motion/react'
import { useEffect } from 'react'
import { engine } from '../audio/engine'
import { selectBeat, selectSample } from '../actions'
import { useStore, type BeatMeta, type SampleMeta } from '../store'
import { sheet } from './motion'

export function Crate() {
  const beats = useStore((s) => s.beats)
  const samples = useStore((s) => s.samples)
  const beatId = useStore((s) => s.settings.beatId)
  const sampleId = useStore((s) => s.settings.sampleId)
  const crateLoaded = useStore((s) => s.crateLoaded)
  const set = useStore((s) => s.set)
  const close = () => set({ panel: null })

  useEffect(() => () => engine.stopPreview(), [])

  const builtinBeats = beats.filter((b) => b.source === 'builtin')
  const builtinSamples = samples.filter((s) => s.source === 'builtin')
  const userBeats = beats.filter((b) => b.source === 'user')
  const userSamples = samples.filter((s) => s.source === 'user')
  const playableBeats = beats.filter((b) => b.playable)

  return (
    <motion.aside className="paper sheet sheet-left" variants={sheet('left')} initial="hidden" animate="show" exit="exit" aria-label="Crate">
      <header className="sheet-head">
        <h2 className="serif">Crate</h2>
        <button className="btn btn-ghost" onClick={close} aria-label="Close crate">
          Close <span className="chip">Tab</span>
        </button>
      </header>
      <div className="sheet-scroll">
        <Section title="Beats">
          {builtinBeats.map((b) => (
            <BeatRow key={b.id} b={b} n={playableBeats.indexOf(b) + 1} active={b.id === beatId} />
          ))}
        </Section>
        <Section title="Samples">
          {builtinSamples.map((s) => (
            <SampleRow key={s.id} s={s} active={s.id === sampleId} />
          ))}
        </Section>
        <Section title="Your crate">
          {userBeats.map((b) => (
            <BeatRow key={b.id} b={b} n={playableBeats.indexOf(b) + 1} active={b.id === beatId} />
          ))}
          {userSamples.map((s) => (
            <SampleRow key={s.id} s={s} active={s.id === sampleId} />
          ))}
          {crateLoaded && !userBeats.length && !userSamples.length && (
            <div className="empty">
              <p className="serif" style={{ fontSize: 20, margin: 0 }}>
                Nothing here yet.
              </p>
              <p className="body" style={{ margin: 0 }}>
                Add your own loops and samples: drop audio files into <code className="mono">public/audio/user/</code> and list them in{' '}
                <code className="mono">manifest.json</code>. Freesound (CC0 filter), Looperman and Sample Focus are good places to dig.
              </p>
            </div>
          )}
          {!crateLoaded && <p className="label">Looking for your files…</p>}
        </Section>
      </div>
      <SheetStyles />
    </motion.aside>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="sec">
      <h3 className="label">{title}</h3>
      <div className="rows">{children}</div>
    </section>
  )
}

function PreviewBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      className="prev"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label={label}
    >
      <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden>
        <path d="M0 0 L9 5 L0 10 Z" fill="currentColor" />
      </svg>
    </button>
  )
}

function BeatRow({ b, n, active }: { b: BeatMeta; n: number; active: boolean }) {
  return (
    <div className={`row ${active ? 'is-active' : ''} ${b.playable ? '' : 'is-off'}`}>
      <button className="row-main" onClick={() => b.playable && selectBeat(b.id)} disabled={!b.playable} aria-pressed={active}>
        <span className="mono row-n">{n > 0 ? n : '–'}</span>
        <span className="row-text">
          <span className="serif row-name">{b.name}</span>
          <span className="row-sub">{b.error ?? b.style}</span>
        </span>
        <span className="mono row-meta">{b.bpm}</span>
      </button>
      {b.playable && <PreviewBtn onClick={() => engine.preview('beat', b.id)} label={`Preview ${b.name}`} />}
    </div>
  )
}

function SampleRow({ s, active }: { s: SampleMeta; active: boolean }) {
  return (
    <div className={`row ${active ? 'is-active' : ''} ${s.playable ? '' : 'is-off'}`}>
      <button className="row-main" onClick={() => s.playable && selectSample(s.id)} disabled={!s.playable} aria-pressed={active}>
        <span className="mono row-n">{active ? '●' : ''}</span>
        <span className="row-text">
          <span className="serif row-name">{s.name}</span>
          <span className="row-sub">{s.error ?? s.note}</span>
        </span>
        <span className="mono row-meta">{s.duration ? `${s.duration.toFixed(2)}s` : ''}</span>
      </button>
      {s.playable && <PreviewBtn onClick={() => engine.preview('sample', s.id)} label={`Preview ${s.name}`} />}
    </div>
  )
}

export function SheetStyles() {
  return (
    <style>{`
      .sheet { position: fixed; top: 16px; bottom: 16px; width: 400px; display: flex; flex-direction: column; overflow: hidden; }
      .sheet-left { left: 16px; }
      .sheet-right { right: 16px; }
      .sheet-head { display: flex; justify-content: space-between; align-items: center; padding: 18px 22px 14px; border-bottom: 1px solid var(--hair); }
      .sheet-head h2 { margin: 0; font-size: 34px; font-weight: 400; line-height: 1; }
      .sheet-head .btn-ghost { gap: 8px; font-size: 11px; }
      .sheet-scroll { overflow-y: auto; padding: 6px 22px 22px; overscroll-behavior: contain; }
      .sec { padding-top: 18px; }
      .sec h3 { margin: 0 0 8px; }
      .rows { display: grid; }
      .row { display: flex; align-items: center; border-top: 1px solid var(--faint); }
      .row:last-child { border-bottom: 1px solid var(--faint); }
      .row-main { flex: 1; display: grid; grid-template-columns: 22px 1fr auto; gap: 10px; align-items: center; padding: 11px 4px; text-align: left; }
      .row-n { color: var(--muted); font-size: 10px; }
      .row-text { display: grid; gap: 1px; }
      .row-name { font-size: 21px; line-height: 1.1; }
      .row-sub { font-size: 11.5px; color: var(--muted); }
      .row-meta { color: var(--muted); }
      .row.is-active .row-name { font-style: italic; }
      .row.is-active .row-n { color: var(--accent); }
      .row.is-active .row-meta { color: var(--ink); }
      .row.is-off { opacity: .5; }
      .row.is-off .row-sub { color: var(--accent); }
      .row:hover:not(.is-off) .row-name { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
      .prev { width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--hair); display: grid; place-items: center; color: var(--ink-2); margin-left: 6px; }
      .prev:hover { border-color: var(--ink); color: var(--ink); }
      .empty { display: grid; gap: 8px; padding: 14px 0; border-top: 1px solid var(--faint); }
      code.mono { font-size: 11px; background: var(--paper-2); padding: 1px 4px; border-radius: 3px; }
      .field { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px 14px; padding: 12px 0; border-top: 1px solid var(--faint); }
      .field-label { font-size: 13px; color: var(--ink); }
      .field-hint { grid-column: 1 / -1; font-size: 11.5px; color: var(--muted); margin-top: -4px; }
      .field-range { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 52px; gap: 12px; align-items: center; }
      .field-range .mono { text-align: right; color: var(--muted); }
    `}</style>
  )
}
