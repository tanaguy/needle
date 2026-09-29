import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { engine } from '../audio/engine'
import { useStore } from '../store'
import { EASE } from './motion'

export function useNarrowScreen() {
  // ?desktop skips the check (small laptop windows, testing)
  const force = new URLSearchParams(location.search).has('desktop')
  const q = () => !force && (window.innerWidth < 900 || (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches))
  const [n, setN] = useState(q)
  useEffect(() => {
    const on = () => setN(q())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return n
}

/** Blocking notices: unsupported browser, blocked audio, narrow screen. */
export function Notice({ narrow }: { narrow: boolean }) {
  const notice = useStore((s) => s.notice)
  const phase = useStore((s) => s.phase)
  const set = useStore((s) => s.set)

  // audio can get suspended by the browser mid-session (e.g. output device change)
  useEffect(() => {
    if (phase !== 'session' && phase !== 'onboarding') return
    const id = setInterval(() => {
      const ctx = engine.ctx
      if (ctx && !document.hidden && ctx.state !== 'running' && !useStore.getState().notice) {
        set({ notice: { kind: 'audio-blocked' } })
      }
    }, 3000)
    return () => clearInterval(id)
  }, [phase, set])

  const kind = notice?.kind ?? (narrow ? 'narrow' : null)

  return (
    <AnimatePresence>
      {kind && (
        <motion.div
          key={kind}
          className="notice-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.3 } }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
        >
          <motion.div
            className="paper notice"
            role="alertdialog"
            aria-labelledby="notice-title"
            initial={{ y: 12 }}
            animate={{ y: 0, transition: { duration: 0.4, ease: EASE } }}
          >
            {kind === 'narrow' && (
              <>
                <div className="label">Needle</div>
                <h2 className="serif" id="notice-title">
                  Made for a <em>laptop trackpad</em>
                </h2>
                <p className="body">Needle is played with a MacBook trackpad and keyboard. Open it on a laptop — or widen this window — to step into the room.</p>
              </>
            )}
            {kind === 'audio-blocked' && (
              <>
                <div className="label">Sound is paused</div>
                <h2 className="serif" id="notice-title">
                  The browser is <em>holding the needle</em>
                </h2>
                <p className="body">Your browser stopped audio for this tab. Click below to start it again. If you still hear nothing, check the tab isn’t muted and your output device is on.</p>
                <button
                  className="btn btn-ink"
                  autoFocus
                  onClick={async () => {
                    const ok = await engine.start()
                    if (ok) set({ notice: null })
                  }}
                >
                  Turn sound on
                </button>
              </>
            )}
            {kind === 'unsupported' && (
              <>
                <div className="label">Browser not supported</div>
                <h2 className="serif" id="notice-title">
                  This browser can’t <em>spin the record</em>
                </h2>
                <p className="body">
                  Needle needs Web Audio worklets for real-time scratching. Please open it in a recent Chrome, Arc, Edge or Safari (17 or newer).
                </p>
              </>
            )}
          </motion.div>
          <style>{`
            .notice-wrap { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(175,195,184,0.55); backdrop-filter: blur(3px); z-index: 60; padding: 16px; }
            .notice { width: min(440px, 100%); padding: 26px 28px; display: grid; gap: 12px; justify-items: start; }
            .notice h2 { margin: 0; font-size: 34px; line-height: 1.05; font-weight: 400; }
            .notice p { margin: 0 0 6px; }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
