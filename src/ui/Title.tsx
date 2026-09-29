import { motion } from 'motion/react'
import { useState } from 'react'
import { engine } from '../audio/engine'
import { useStore } from '../store'
import { rise } from './motion'

export function Title() {
  const set = useStore((s) => s.set)
  const onboarded = useStore((s) => s.settings.onboarded)
  const [busy, setBusy] = useState(false)

  const begin = async () => {
    setBusy(true)
    const ok = await engine.start()
    setBusy(false)
    if (!ok) {
      set({ notice: { kind: 'audio-blocked' } })
      return
    }
    set({ phase: onboarded ? 'session' : 'onboarding' })
  }

  return (
    <motion.section className="title" initial="hidden" animate="show" exit="exit" variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.3 } } }}>
      <motion.header className="title-top" variants={rise}>
        <span className="label">Vol. 01 · Free Session</span>
      </motion.header>

      <div className="title-main">
        <motion.h1 className="serif title-mark" variants={rise}>
          <em>Needle</em>
        </motion.h1>
        <motion.p className="serif title-sub" variants={rise}>
          A small room for learning to scratch.
          <br />
          Your trackpad is the record. Your keyboard is the fader.
        </motion.p>
        <motion.div className="title-actions" variants={rise}>
          <button className="btn btn-ink" onClick={begin} disabled={busy} autoFocus>
            {onboarded ? 'Enter session' : 'Begin'}
            <span aria-hidden>→</span>
          </button>
          {onboarded && (
            <button
              className="btn btn-ghost"
              onClick={async () => {
                if (await engine.start()) set({ phase: 'onboarding' })
              }}
            >
              Replay setup
            </button>
          )}
        </motion.div>
      </div>

      <motion.footer className="title-foot" variants={rise}>
        <span className="label">
          <HeadphonesIcon /> Headphones recommended
        </span>
      </motion.footer>

      <style>{`
        .title { position: fixed; inset: 0; display: grid; grid-template-rows: auto 1fr auto; padding: var(--gutter) calc(var(--gutter) + 8px); pointer-events: none; }
        .title > * { pointer-events: auto; }
        .title-top, .title-foot { display: flex; justify-content: space-between; align-items: center; }
        .title-top { justify-content: flex-end; }
        .title-main { align-self: end; padding-bottom: 7vh; max-width: 620px; }
        .title-mark { margin: 0; font-size: clamp(96px, 13vw, 184px); line-height: 0.86; letter-spacing: -0.03em; color: var(--ink); }
        .title-sub { margin: 22px 0 30px; font-size: 23px; line-height: 1.32; color: var(--ink-2); }
        .title-actions { display: flex; gap: 14px; align-items: center; }
        .title-foot .label { display: inline-flex; align-items: center; gap: 8px; color: var(--ink-2); }
      `}</style>
    </motion.section>
  )
}

function HeadphonesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
      <path d="M2.5 10V8a5.5 5.5 0 0 1 11 0v2" />
      <rect x="1.8" y="9.5" width="3" height="4.5" rx="1" />
      <rect x="11.2" y="9.5" width="3" height="4.5" rx="1" />
    </svg>
  )
}
