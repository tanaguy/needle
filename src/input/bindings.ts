export type Action =
  | 'fader'
  | 'faderA'
  | 'faderB'
  | 'hamster'
  | 'cue'
  | 'motor'
  | 'record'
  | 'camera'
  | 'crate'
  | 'help'
  | 'prevSample'
  | 'nextSample'

export type Bindings = Record<Action, string>

export const DEFAULT_BINDINGS: Bindings = {
  fader: 'Space',
  faderA: 'KeyJ',
  faderB: 'KeyK',
  hamster: 'ShiftLeft',
  cue: 'KeyQ',
  motor: 'KeyM',
  record: 'KeyR',
  camera: 'KeyC',
  crate: 'Tab',
  help: 'Slash',
  prevSample: 'BracketLeft',
  nextSample: 'BracketRight',
}

export const ACTION_LABEL: Record<Action, string> = {
  fader: 'Open fader (hold)',
  faderA: 'Fader tap — left finger',
  faderB: 'Fader tap — right finger',
  hamster: 'Hamster (flip fader)',
  cue: 'Back to cue',
  motor: 'Motor on / off',
  record: 'Record take',
  camera: 'Deck / Room view',
  crate: 'Open crate',
  help: 'Show keys',
  prevSample: 'Previous sample',
  nextSample: 'Next sample',
}

export const REBINDABLE: Action[] = [
  'fader',
  'faderA',
  'faderB',
  'hamster',
  'cue',
  'motor',
  'record',
  'camera',
  'crate',
  'prevSample',
  'nextSample',
]

export function keyLabel(code: string): string {
  if (code === 'Space') return 'Space'
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift'
  if (code === 'BracketLeft') return '['
  if (code === 'BracketRight') return ']'
  if (code === 'Slash') return '?'
  if (code === 'Escape') return 'Esc'
  if (code.startsWith('Arrow')) return { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' }[code] ?? code
  return code.replace(/(Left|Right)$/, '')
}
