import { engine } from '../audio/engine'
import { useStore } from '../store'
import { cycleSample, selectBeatIndex, toggleCamera, toggleMotor, toggleRecord } from '../actions'
import type { Action } from './bindings'
import { FEATURES } from '../config'

const faderKeys = new Set<string>()
let capture: ((code: string) => void) | null = null

/** While set, the next keydown goes to the rebinding UI instead of the game. */
export function captureNextKey(cb: ((code: string) => void) | null) {
  capture = cb
}

function syncFader() {
  const s = useStore.getState()
  const open = faderKeys.size > 0 !== s.hamster
  if (open !== s.faderOpen) {
    engine.setFader(open)
    s.set({ faderOpen: open })
  }
}

function matches(binding: string, code: string) {
  if (binding === code) return true
  // either Shift key works for a Shift binding
  return binding.startsWith('Shift') && code.startsWith('Shift')
}

function actionFor(code: string): Action | null {
  const b = useStore.getState().settings.bindings
  for (const a of Object.keys(b) as Action[]) if (b[a] && matches(b[a], code)) return a
  return null
}

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null
  if (!el) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
}

export function attachKeyboard() {
  const down = (e: KeyboardEvent) => {
    if (capture) {
      e.preventDefault()
      const cb = capture
      capture = null
      if (e.code !== 'Escape') cb(e.code)
      else cb('')
      return
    }
    const s = useStore.getState()
    const inGame = s.phase === 'session' || s.phase === 'onboarding'

    if (e.code === 'Escape') {
      if (s.phase !== 'session') return
      e.preventDefault()
      s.set({ panel: s.panel === null ? 'settings' : null, help: false })
      return
    }
    if (!inGame || isTyping(e.target)) return

    const action = actionFor(e.code)

    // a panel is open: its own keys take over, except closing the crate with its key
    if (s.take) return
    if (s.panel) {
      if (action === 'crate' && s.panel === 'crate') {
        e.preventDefault()
        s.set({ panel: null })
      }
      return
    }

    // Space/Tab/Shift should never scroll, focus-hop, or click buttons while playing
    if (action || e.code === 'Space' || e.code === 'Tab') e.preventDefault()
    if (e.repeat) return

    if (/^Digit[1-9]$/.test(e.code)) {
      if (s.phase === 'session') selectBeatIndex(Number(e.code.slice(5)) - 1)
      return
    }

    switch (action) {
      case 'fader':
      case 'faderA':
      case 'faderB':
        faderKeys.add(e.code)
        syncFader()
        break
      case 'hamster':
        s.set({ hamster: !s.hamster, announce: s.hamster ? 'Hamster off' : 'Hamster on' })
        syncFader()
        break
      case 'cue':
        engine.cue()
        break
      case 'motor':
        toggleMotor()
        break
      case 'record':
        if (s.phase === 'session' && FEATURES.recording) toggleRecord()
        break
      case 'camera':
        toggleCamera()
        break
      case 'crate':
        if (s.phase === 'session') s.set({ panel: 'crate', help: false })
        break
      case 'help':
        s.set({ help: !s.help })
        break
      case 'prevSample':
        cycleSample(-1)
        break
      case 'nextSample':
        cycleSample(1)
        break
    }
  }

  const up = (e: KeyboardEvent) => {
    const s = useStore.getState()
    // Space activates focused buttons on keyup — not while it's the fader
    if ((s.phase === 'session' || s.phase === 'onboarding') && !s.panel && !s.take && e.code === 'Space') e.preventDefault()
    if (faderKeys.delete(e.code)) syncFader()
  }
  const clear = () => {
    if (faderKeys.size) {
      faderKeys.clear()
      syncFader()
    }
  }

  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', clear)
  const unsub = useStore.subscribe((s, p) => {
    if (s.panel && !p.panel) clear()
  })
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', clear)
    unsub()
  }
}
