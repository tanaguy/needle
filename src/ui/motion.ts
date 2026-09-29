import type { Variants } from 'motion/react'

export const EASE = [0.22, 1, 0.36, 1] as const

export const rise: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.24, ease: EASE } },
}

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.24, ease: EASE } },
  exit: { opacity: 0, transition: { duration: 0.2, ease: EASE } },
}

export const sheet = (from: 'left' | 'right'): Variants => ({
  hidden: { opacity: 0, x: from === 'left' ? -24 : 24 },
  show: { opacity: 1, x: 0, transition: { duration: 0.28, ease: EASE } },
  exit: { opacity: 0, x: from === 'left' ? -16 : 16, transition: { duration: 0.2, ease: EASE } },
})
