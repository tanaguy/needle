import { useEffect, useState } from 'react'

let ready = false
const p: Promise<unknown> =
  typeof document !== 'undefined' && document.fonts
    ? Promise.race([
        Promise.all([
          document.fonts.load('italic 40px "Instrument Serif"'),
          document.fonts.load('40px "Instrument Serif"'),
          document.fonts.load('500 16px Inter'),
          document.fonts.load('400 16px "JetBrains Mono"'),
        ]),
        new Promise((r) => setTimeout(r, 4000)), // offline: fall back to system fonts
      ]).then(() => (ready = true))
    : Promise.resolve(true)

export function fontsReady() {
  return p
}

export function useFontsReady() {
  const [r, setR] = useState(ready)
  useEffect(() => {
    if (!r) p.then(() => setR(true))
  }, [r])
  return r
}
