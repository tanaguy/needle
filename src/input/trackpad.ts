import { engine, deck } from '../audio/engine'
import { getSettings, useStore } from '../store'
import { MomentumFilter } from './momentum'

type RawListener = (px: number, kind: 'swipe' | 'drag') => void
const rawListeners = new Set<RawListener>()
/** Raw, un-scaled movement in px (after invert) — used by calibration. */
export function onRawMove(cb: RawListener) {
  rawListeners.add(cb)
  return () => rawListeners.delete(cb)
}

let lastInputAt = 0
/** ms timestamp of the last platter input — the camera sways only when you're idle. */
export const lastPlatterInput = () => lastInputAt

function active() {
  const s = useStore.getState()
  return (s.phase === 'session' || s.phase === 'onboarding') && s.panel === null && engine.ready
}

export function attachTrackpad(surface: HTMLElement) {
  const mf = new MomentumFilter()

  const onWheel = (e: WheelEvent) => {
    // never let the page scroll or zoom while playing
    if (!active()) return
    e.preventDefault()
    if (e.ctrlKey) return // pinch-zoom gesture
    const s = getSettings()
    if (s.gesture !== 'swipe') return
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
    let px = (e.deltaY + e.deltaX) * unit
    if (s.invert) px = -px
    const verdict = mf.push(px, e.timeStamp)
    if (verdict === 'ignore') return
    lastInputAt = performance.now()
    rawListeners.forEach((l) => l(px, 'swipe'))
    if (!deck.hand) engine.grab()
    engine.move(px / s.swipePxPerTurn)
    if (verdict === 'release') engine.release()
  }

  let dragging = -1
  const onDown = (e: PointerEvent) => {
    if (!active() || getSettings().gesture !== 'drag' || e.button !== 0) return
    if (e.target !== surface) return
    dragging = e.pointerId
    surface.setPointerCapture(e.pointerId)
    surface.classList.add('is-holding')
    engine.grab()
    lastInputAt = performance.now()
  }
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== dragging) return
    const s = getSettings()
    let px = -(e.movementY + e.movementX)
    if (s.invert) px = -px
    if (px === 0) return
    lastInputAt = performance.now()
    rawListeners.forEach((l) => l(px, 'drag'))
    engine.move(px / s.dragPxPerTurn)
  }
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== dragging) return
    dragging = -1
    surface.classList.remove('is-holding')
    if (surface.hasPointerCapture(e.pointerId)) surface.releasePointerCapture(e.pointerId)
    engine.release()
  }

  // Safari pinch
  const stopGesture = (e: Event) => e.preventDefault()

  window.addEventListener('wheel', onWheel, { passive: false })
  surface.addEventListener('pointerdown', onDown)
  surface.addEventListener('pointermove', onMove)
  surface.addEventListener('pointerup', onUp)
  surface.addEventListener('pointercancel', onUp)
  document.addEventListener('gesturestart', stopGesture)
  return () => {
    window.removeEventListener('wheel', onWheel)
    surface.removeEventListener('pointerdown', onDown)
    surface.removeEventListener('pointermove', onMove)
    surface.removeEventListener('pointerup', onUp)
    surface.removeEventListener('pointercancel', onUp)
    document.removeEventListener('gesturestart', stopGesture)
  }
}
