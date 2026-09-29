// Scene palette — flat colour, Art-of-Rally-style diorama.
export const P = {
  bg: '#AFC3B8', // faded sage (background + fog)
  sand: '#E7D8BE', // platform top
  sandSide: '#C9B18C',
  wood: '#B98A5E',
  woodDark: '#8E6444',
  terracotta: '#C8643B', // the one strong accent — cue sticker
  clay: '#D6946C',
  olive: '#7F8F4E',
  oliveDark: '#5E6B3A',
  teal: '#4F7C7A',
  tealDark: '#3D625F',
  offwhite: '#F1EBDD',
  cream: '#E9DFC9',
  charcoal: '#2B2A28',
  charcoalHi: '#3A3936',
  metal: '#CFC7B8',
  lamp: '#FFE6B0',
  sun: '#FFE1B5',
  sky: '#D4E6E4',
  ground: '#C9A77A',
} as const

// UI tokens live in theme.css; mirror the few we need in canvas code.
export const UI = {
  ink: '#1B1A17',
  paper: '#F3EEE3',
  accent: '#C8643B',
  muted: 'rgba(27,26,23,0.55)',
  faint: 'rgba(27,26,23,0.14)',
} as const
