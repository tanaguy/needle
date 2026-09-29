import { engine } from './audio/engine'
import { getSettings, useStore } from './store'

/** Mixer channel faders, mapped to the two decks. */
export type Channel = 'sampleLevel' | 'beatLevel'

export const CHANNEL_LABEL: Record<Channel, string> = {
  sampleLevel: 'Scratch',
  beatLevel: 'Beat',
}

/**
 * Which on-deck control the pointer is over / holding. Written by the 3D scene,
 * read by the trackpad handler so scrolls and presses go to the fader instead of the record.
 */
export const hover = {
  over: null as Channel | null,
  held: null as Channel | null,
  lastAdjust: { sampleLevel: 0, beatLevel: 0 } as Record<Channel, number>,
}

export function setLevel(ch: Channel, v: number) {
  const next = Math.min(1, Math.max(0, v))
  if (Math.abs(next - getSettings()[ch]) < 1e-4) return
  useStore.getState().setSettings({ [ch]: next })
  engine.applyLevels()
  hover.lastAdjust[ch] = performance.now()
}

export function nudgeLevel(ch: Channel, d: number) {
  setLevel(ch, getSettings()[ch] + d)
}
