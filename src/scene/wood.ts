import * as THREE from 'three'

/** Stylised wood grain for the DJ table, drawn in code (fits the flat, Art-of-Rally look). */

let proceduralImg: HTMLCanvasElement | null = null
/** Long grain running along U, drawn near-white so the material colour tints it. */
function proceduralCanvas() {
  if (proceduralImg) return proceduralImg
  const W = 1024
  const H = 256
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, W, H)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  // growth rings: gently wavy streaks, some darker, some lighter
  for (let i = 0; i < 70; i++) {
    const y0 = rnd() * H
    const amp = 2 + rnd() * 6
    const freq = (1 + Math.floor(rnd() * 3)) * ((Math.PI * 2) / W) // whole waves → tiles seamlessly
    const phase = rnd() * Math.PI * 2
    const dark = rnd() < 0.75
    g.strokeStyle = dark ? `rgba(90,55,25,${0.05 + rnd() * 0.1})` : `rgba(255,245,225,${0.1 + rnd() * 0.15})`
    g.lineWidth = 0.6 + rnd() * 2.2
    for (const off of [-H, 0, H]) {
      g.beginPath()
      for (let x = 0; x <= W; x += 8) {
        const y = y0 + off + Math.sin(x * freq + phase) * amp
        if (x === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.stroke()
    }
  }
  // soft broad bands for figure
  for (let i = 0; i < 6; i++) {
    const y = rnd() * H
    const grad = g.createLinearGradient(0, y - 18, 0, y + 18)
    grad.addColorStop(0, 'rgba(120,80,40,0)')
    grad.addColorStop(0.5, `rgba(120,80,40,${0.05 + rnd() * 0.05})`)
    grad.addColorStop(1, 'rgba(120,80,40,0)')
    g.fillStyle = grad
    g.fillRect(0, y - 18, W, 36)
  }
  proceduralImg = c
  return c
}

const cache = new Map<string, THREE.MeshStandardMaterial>()

/**
 * A wood material for a box whose grain runs along its longest face direction.
 * `along` / `across` are the world sizes (m) that the texture's U / V span on that face;
 * `vertical` rotates the grain for posts and legs.
 */
export function woodMaterial(color: string, along: number, across: number, vertical = false) {
  const key = `${color}|${along}|${across}|${vertical}`
  let m = cache.get(key)
  if (m) return m
  const tex = new THREE.CanvasTexture(proceduralCanvas())
  tex.repeat.set(along / 1.0, across / 0.25) // one tile ≈ 1 m of grain × 25 cm
  if (vertical) {
    tex.rotation = Math.PI / 2
    tex.center.set(0.5, 0.5)
  }
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  m = new THREE.MeshStandardMaterial({ color, map: tex, roughness: 0.78, flatShading: true })
  cache.set(key, m)
  return m
}
