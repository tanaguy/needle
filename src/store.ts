import { create } from 'zustand'
import { DEFAULT_BINDINGS, type Bindings } from './input/bindings'

export type Phase = 'loading' | 'title' | 'onboarding' | 'session'
export type Panel = null | 'crate' | 'settings'
export type Gesture = 'swipe' | 'drag'

export type Settings = {
  gesture: Gesture
  swipePxPerTurn: number
  dragPxPerTurn: number
  invert: boolean
  faderCurve: 'cut' | 'smooth'
  motorStartMs: number
  camera: 'deck' | 'room'
  volume: number
  beatLevel: number
  sampleLevel: number
  reduceMotion: boolean
  quality: 'high' | 'low'
  bindings: Bindings
  onboarded: boolean
  beatId: string
  sampleId: string
}

export type BeatMeta = {
  id: string
  name: string
  bpm: number
  style: string
  bars: number
  source: 'builtin' | 'user'
  playable: boolean
  error?: string
}
export type SampleMeta = {
  id: string
  name: string
  note: string
  duration: number
  source: 'builtin' | 'user'
  playable: boolean
  error?: string
}

export type Notice = null | { kind: 'audio-blocked' | 'unsupported' | 'narrow'; text?: string }

export type Take = { l: Float32Array; r: Float32Array; sampleRate: number; duration: number }

type State = {
  phase: Phase
  load: number
  loadLabel: string
  panel: Panel
  help: boolean
  settings: Settings
  beats: BeatMeta[]
  samples: SampleMeta[]
  crateLoaded: boolean
  faderOpen: boolean
  hamster: boolean
  motorOn: boolean
  recording: boolean
  recStartedAt: number
  take: Take | null
  notice: Notice
  announce: string
  set: (p: Partial<State>) => void
  setSettings: (p: Partial<Settings>) => void
}

const KEY = 'needle.settings.v1'

const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export const DEFAULT_SETTINGS: Settings = {
  gesture: 'swipe',
  swipePxPerTurn: 1400,
  dragPxPerTurn: 900,
  invert: false,
  faderCurve: 'cut',
  motorStartMs: 90,
  camera: 'deck',
  volume: 0.85,
  beatLevel: 0.62,
  sampleLevel: 0.9,
  reduceMotion: reduce,
  quality: 'high',
  bindings: DEFAULT_BINDINGS,
  onboarded: false,
  beatId: 'boom-bap',
  sampleId: 'ahh',
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    const bindings = { ...DEFAULT_BINDINGS, ...(parsed.bindings ?? {}) }
    // v1 → v2: R used to record and C switched the camera; R is now the room view
    if (bindings.record === 'KeyR' && bindings.camera === 'KeyC') {
      bindings.camera = 'KeyR'
      bindings.record = DEFAULT_BINDINGS.record
    }
    return { ...DEFAULT_SETTINGS, ...parsed, bindings }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode — settings just won't persist */
  }
}

export const useStore = create<State>((set, get) => ({
  phase: 'loading',
  load: 0,
  loadLabel: 'Pressing the record',
  panel: null,
  help: false,
  settings: loadSettings(),
  beats: [],
  samples: [],
  crateLoaded: false,
  faderOpen: false,
  hamster: false,
  motorOn: true,
  recording: false,
  recStartedAt: 0,
  take: null,
  notice: null,
  announce: '',
  set: (p) => set(p),
  setSettings: (p) => {
    const next = { ...get().settings, ...p }
    saveSettings(next)
    set({ settings: next })
  },
}))

export const getSettings = () => useStore.getState().settings
