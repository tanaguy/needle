import { useProgress } from '@react-three/drei'
import { AnimatePresence } from 'motion/react'
import { useEffect, useRef } from 'react'
import { engine } from './audio/engine'
import { attachKeyboard } from './input/keyboard'
import { attachTrackpad } from './input/trackpad'
import { Stage } from './scene/Stage'
import { fontsReady } from './scene/useFontsReady'
import { useStore } from './store'
import { Loading } from './ui/Loading'
import { Title } from './ui/Title'
import { Onboarding } from './ui/Onboarding'
import { HUD } from './ui/HUD'
import { Crate } from './ui/Crate'
import { Settings } from './ui/Settings'
import { TakeReview } from './ui/TakeReview'
import { Notice, useNarrowScreen } from './ui/Notice'

export default function App() {
  const phase = useStore((s) => s.phase)
  const panel = useStore((s) => s.panel)
  const take = useStore((s) => s.take)
  const announce = useStore((s) => s.announce)
  const gesture = useStore((s) => s.settings.gesture)
  const set = useStore((s) => s.set)
  const stageRef = useRef<HTMLDivElement>(null)
  const models = useProgress()
  const narrow = useNarrowScreen()

  // boot: audio synthesis + fonts + models
  useEffect(() => {
    let alive = true
    engine
      .init((p, label) => alive && set({ load: p, loadLabel: label }))
      .catch(() => alive && set({ notice: { kind: 'unsupported' } }))
    return () => {
      alive = false
    }
  }, [set])

  useEffect(() => {
    if (phase !== 'loading') return
    const check = async () => {
      await fontsReady()
      if (engine.ready && !models.active && models.progress >= 100) {
        set({ load: 1, loadLabel: 'Ready' })
        setTimeout(() => set({ phase: 'title' }), 450)
      }
    }
    check()
    const id = setInterval(check, 200)
    return () => clearInterval(id)
  }, [phase, models.active, models.progress, set])

  useEffect(() => {
    if (!stageRef.current) return
    const offPad = attachTrackpad(stageRef.current)
    const offKeys = attachKeyboard()
    return () => {
      offPad()
      offKeys()
    }
  }, [])

  const inPlay = phase === 'session' || phase === 'onboarding'

  return (
    <>
      <div ref={stageRef} className={`stage ${inPlay && gesture === 'drag' ? 'is-drag' : ''}`}>
        <Stage />
      </div>
      <div className="overlay">
        <AnimatePresence>
          {phase === 'loading' && <Loading key="loading" modelProgress={models.progress / 100} />}
          {phase === 'title' && !narrow && <Title key="title" />}
          {phase === 'onboarding' && <Onboarding key="onboarding" />}
          {phase === 'session' && <HUD key="hud" />}
          {phase === 'session' && panel === 'crate' && <Crate key="crate" />}
          {panel === 'settings' && <Settings key="settings" />}
          {take && <TakeReview key="take" />}
        </AnimatePresence>
        <Notice narrow={narrow && phase !== 'loading'} />
      </div>
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
    </>
  )
}
