import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { engine } from '../audio/engine'
import { useStore } from '../store'
import { P } from '../palette'
import { flat } from './materials'
import { woodMaterial } from './wood'

// OJAS-style horn speaker (after Devon Turnbull's hi-fi): butt-joined Baltic birch
// cabinet with the ply layers left showing, a big woofer on a dark baffle, and a
// sand-cast aluminium multicell horn sitting on top. Metres; origin = floor, centre.
const W = 0.46 // cabinet width
const H = 0.6 // cabinet height
const D = 0.4 // cabinet depth
const T = 0.022 // panel thickness
const STAND = 0.3 // plinth height

const BIRCH = '#E4CDA6'
const PLY_DARK = '#C9A877'
const ALU = '#C9C6BF'

let plyCanvas: HTMLCanvasElement | null = null
/** Stripes of a 13-ply Baltic birch edge. */
function plyTexture(vertical: boolean) {
  if (!plyCanvas) {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const g = c.getContext('2d')!
    const n = 13
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? PLY_DARK : BIRCH
      g.fillRect(0, (i * 64) / n, 64, 64 / n + 1)
    }
    plyCanvas = c
  }
  const t = new THREE.CanvasTexture(plyCanvas)
  t.colorSpace = THREE.SRGBColorSpace
  if (vertical) {
    t.rotation = Math.PI / 2
    t.center.set(0.5, 0.5)
  }
  return t
}

const plyEdgeCache = new Map<string, THREE.MeshStandardMaterial>()
function plyEdge(vertical: boolean) {
  const k = String(vertical)
  let m = plyEdgeCache.get(k)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: plyTexture(vertical), roughness: 0.85, flatShading: true })
    plyEdgeCache.set(k, m)
  }
  return m
}

/** A panel whose front (+z) edge shows the ply layers; the rest is birch face. */
function Panel({ size, position, vertical }: { size: [number, number, number]; position: [number, number, number]; vertical: boolean }) {
  const mats = useMemo(() => {
    const face = woodMaterial(BIRCH, Math.max(size[0], size[1], size[2]), Math.min(size[0], size[1], size[2]) * 6, vertical)
    const edge = plyEdge(vertical)
    // box material order: +x, -x, +y, -y, +z, -z
    return [face, face, face, face, edge, face]
  }, [size, vertical])
  return (
    <mesh position={position} material={mats} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  )
}

const R = 0.15 // woofer radius
const WOOFER_Y = H * 0.42
const BAFFLE_Z = D / 2 - 0.03 // back face of the recessed baffle
const BAFFLE_T = 0.012
const BF = BAFFLE_Z + BAFFLE_T // baffle front face

/** Charcoal front baffle with a round cut-out, so the cone sits properly inside it. */
function Baffle() {
  const geom = useMemo(() => {
    const w = W - 2 * T
    const h = H - 2 * T
    const shape = new THREE.Shape()
    shape.moveTo(-w / 2, -h / 2)
    shape.lineTo(w / 2, -h / 2)
    shape.lineTo(w / 2, h / 2)
    shape.lineTo(-w / 2, h / 2)
    shape.lineTo(-w / 2, -h / 2)
    const hole = new THREE.Path()
    hole.absarc(0, WOOFER_Y - H / 2, R, 0, Math.PI * 2, true)
    shape.holes.push(hole)
    return new THREE.ExtrudeGeometry(shape, { depth: BAFFLE_T, bevelEnabled: false, curveSegments: 40 })
  }, [])
  return <mesh geometry={geom} position={[0, STAND + H / 2, BAFFLE_Z]} material={flat(P.charcoalHi, { rough: 0.8 })} receiveShadow />
}

function Woofer({ cone }: { cone: React.RefObject<THREE.Group | null> }) {
  return (
    <group position={[0, STAND + WOOFER_Y, 0]}>
      {/* basket behind the cut-out */}
      <mesh position-z={BF - 0.07} rotation-x={Math.PI / 2} material={flat('#1a1918')}>
        <cylinderGeometry args={[R, R, 0.01, 40]} />
      </mesh>
      {/* frame ring on the baffle */}
      <mesh position-z={BF + 0.002} material={flat(P.charcoal, { rough: 0.5 })}>
        <ringGeometry args={[R - 0.004, R + 0.016, 40]} />
      </mesh>
      {/* rubber surround */}
      <mesh position-z={BF - 0.002} material={flat('#242321', { rough: 0.9 })}>
        <torusGeometry args={[R - 0.014, 0.011, 8, 40]} />
      </mesh>
      <group ref={cone}>
        {/* paper cone: wide at the front, narrowing back into the box */}
        <mesh position-z={BF - 0.03} rotation-x={Math.PI / 2} material={new THREE.MeshStandardMaterial({ color: '#34312d', roughness: 0.95, side: THREE.DoubleSide, flatShading: true })}>
          <cylinderGeometry args={[R - 0.022, 0.04, 0.05, 40, 1, true]} />
        </mesh>
        {/* dust cap */}
        <mesh position-z={BF - 0.056} rotation-x={Math.PI / 2} material={flat(P.charcoal, { rough: 0.45 })}>
          <sphereGeometry args={[0.042, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      </group>
    </group>
  )
}

/** Open rectangular funnel from a small throat (back) to a wide mouth (front, +z). */
function flareGeometry(throatW: number, throatH: number, mouthW: number, mouthH: number, depth: number) {
  const zb = -depth / 2
  const zf = depth / 2
  const t = [
    [-throatW / 2, -throatH / 2, zb],
    [throatW / 2, -throatH / 2, zb],
    [throatW / 2, throatH / 2, zb],
    [-throatW / 2, throatH / 2, zb],
  ]
  const m = [
    [-mouthW / 2, -mouthH / 2, zf],
    [mouthW / 2, -mouthH / 2, zf],
    [mouthW / 2, mouthH / 2, zf],
    [-mouthW / 2, mouthH / 2, zf],
  ]
  const pos: number[] = []
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    pos.push(...t[i], ...t[j], ...m[j], ...t[i], ...m[j], ...m[i])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

/** Multicell horn: a flared aluminium mouth split into a 3 × 2 grid of cells. */
function Horn() {
  const alu = useMemo(() => new THREE.MeshStandardMaterial({ color: ALU, roughness: 0.5, metalness: 0.55, side: THREE.DoubleSide, flatShading: true }), [])
  const cast = flat('#B3B0A8', { rough: 0.7, metal: 0.4 })
  const mouthW = 0.3
  const mouthH = 0.14
  const depth = 0.2
  const flare = useMemo(() => flareGeometry(0.05, 0.04, mouthW, mouthH, depth), [])
  const cy = mouthH / 2 + 0.012
  return (
    <group position={[0, H + STAND, 0.03]}>
      <group position-y={cy}>
        <mesh geometry={flare} material={alu} castShadow />
        {/* dark throat plate deep inside */}
        <mesh position-z={-depth / 2 + 0.002} material={flat('#141312')}>
          <planeGeometry args={[0.05, 0.04]} />
        </mesh>
        {/* multicell dividers: 3 across × 2 high, following the flare */}
        {[-1, 1].map((i) => (
          <mesh key={`v${i}`} position={[(i * mouthW) / 6, 0, depth / 2 - 0.05]} rotation-y={i * 0.28} material={cast} castShadow>
            <boxGeometry args={[0.005, mouthH - 0.01, 0.1]} />
          </mesh>
        ))}
        <mesh position={[0, 0, depth / 2 - 0.05]} material={cast}>
          <boxGeometry args={[mouthW - 0.02, 0.005, 0.1]} />
        </mesh>
        {/* cast mouth rim */}
        {[
          [0, mouthH / 2 + 0.006, mouthW + 0.024, 0.012],
          [0, -mouthH / 2 - 0.006, mouthW + 0.024, 0.012],
          [mouthW / 2 + 0.006, 0, 0.012, mouthH],
          [-mouthW / 2 - 0.006, 0, 0.012, mouthH],
        ].map(([x, y, w, h], i) => (
          <mesh key={i} position={[x, y, depth / 2]} material={cast} castShadow>
            <boxGeometry args={[w, h, 0.014]} />
          </mesh>
        ))}
        {/* compression driver on the throat */}
        <mesh position={[0, 0, -depth / 2 - 0.035]} rotation-x={Math.PI / 2} material={flat(P.charcoal, { rough: 0.5 })} castShadow>
          <cylinderGeometry args={[0.055, 0.055, 0.07, 24]} />
        </mesh>
      </group>
      {/* cast feet */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.1, 0.006, -0.02]} material={cast}>
          <boxGeometry args={[0.03, 0.012, depth]} />
        </mesh>
      ))}
    </group>
  )
}

export function OjasSpeaker({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const cone = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!cone.current) return
    const s = useStore.getState()
    let kick = 0
    if (engine.started && !engine.beatPaused && !s.settings.reduceMotion) kick = Math.exp(-(engine.beatNow() % 1) * 9)
    cone.current.position.z = kick * 0.012 // the woofer pushes out on the kick
  })

  const y0 = STAND
  return (
    <group position={position} rotation-y={rotation}>
      {/* plinth: a darker, recessed stand */}
      <mesh position-y={STAND / 2} material={woodMaterial(P.woodDark, W, 0.2)} castShadow receiveShadow>
        <boxGeometry args={[W - 0.06, STAND, D - 0.06]} />
      </mesh>

      {/* butt-joined birch cabinet: sides full height, top/bottom between them */}
      <Panel size={[T, H, D]} position={[-W / 2 + T / 2, y0 + H / 2, 0]} vertical />
      <Panel size={[T, H, D]} position={[W / 2 - T / 2, y0 + H / 2, 0]} vertical />
      <Panel size={[W - 2 * T, T, D]} position={[0, y0 + H - T / 2, 0]} vertical={false} />
      <Panel size={[W - 2 * T, T, D]} position={[0, y0 + T / 2, 0]} vertical={false} />
      <mesh position={[0, y0 + H / 2, -D / 2 + T / 2]} material={woodMaterial(BIRCH, W, H)} castShadow>
        <boxGeometry args={[W - 2 * T, H - 2 * T, T]} />
      </mesh>

      {/* recessed baffle, painted charcoal, with the woofer in its cut-out */}
      <Baffle />
      <Woofer cone={cone} />

      {/* bass ports */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.12, y0 + H * 0.83, BF + 0.003]}>
          <mesh rotation-x={Math.PI / 2} material={flat(P.charcoal)}>
            <cylinderGeometry args={[0.028, 0.028, 0.01, 24]} />
          </mesh>
          <mesh rotation-x={Math.PI / 2} position-z={0.001} material={flat('#141312')}>
            <cylinderGeometry args={[0.021, 0.021, 0.012, 24]} />
          </mesh>
        </group>
      ))}

      <Horn />
    </group>
  )
}
