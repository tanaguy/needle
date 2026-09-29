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
/**
 * Multicellular horn, cinema-style: a 3 × 2 bank of rectangular cells that all start at
 * one throat and fan out, so the mouth forms a curved arc. Matte black.
 */
function Horn() {
  // two blacks: a satin outer shell and a near-black interior, so each cell reads as a tube
  const shell = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2c2b29', roughness: 0.5, metalness: 0.2, side: THREE.FrontSide, flatShading: true }), [])
  const inner = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0c0b0a', roughness: 0.95, side: THREE.BackSide }), [])
  const rim = flat('#4a4845', { rough: 0.5, metal: 0.2 })
  const LEN = 0.19 // cell length, throat → mouth
  const MW = 0.063 // mouth width: neighbours meet edge-to-edge at the mouth
  const MH = 0.068
  const cell = useMemo(() => flareGeometry(0.018, 0.03, MW, MH, LEN), [])
  const COLS = [-1, 0, 1]
  const ROWS = [-1, 1]
  const FAN_H = 0.33 // radians between columns
  const FAN_V = 0.19 // radians between rows
  return (
    <group position={[0, H + STAND, 0.02]}>
      {/* base plate the horn rests on */}
      <mesh position={[0, 0.006, -0.02]} material={shell} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.012, 0.2]} />
      </mesh>
      <group position={[0, 0.095, -0.1]}>
        {COLS.flatMap((c) =>
          ROWS.map((r) => (
            // every cell pivots at the shared throat and points out along its own axis
            <group key={`${c}${r}`} position-y={r * 0.017} rotation={[-r * FAN_V * 0.5, c * FAN_H, 0]}>
              <mesh geometry={cell} position-z={LEN / 2} material={shell} castShadow />
              <mesh geometry={cell} position-z={LEN / 2} material={inner} />
              {/* mouth rim */}
              {[
                [0, MH / 2, MW + 0.004, 0.004],
                [0, -MH / 2, MW + 0.004, 0.004],
                [MW / 2, 0, 0.004, MH],
                [-MW / 2, 0, 0.004, MH],
              ].map(([x, y, w, h], i) => (
                <mesh key={i} position={[x, y, LEN]} material={rim}>
                  <boxGeometry args={[w, h, 0.006]} />
                </mesh>
              ))}
            </group>
          )),
        )}
        {/* throat block + compression driver behind */}
        <mesh position-z={-0.012} material={shell} castShadow>
          <boxGeometry args={[0.05, 0.075, 0.04]} />
        </mesh>
        <mesh position={[0, -0.045, -0.012]} material={shell}>
          <boxGeometry args={[0.04, 0.05, 0.04]} />
        </mesh>
        <mesh position-z={-0.068} rotation-x={Math.PI / 2} material={flat('#161514', { rough: 0.45, metal: 0.3 })} castShadow>
          <cylinderGeometry args={[0.056, 0.056, 0.072, 28]} />
        </mesh>
      </group>
    </group>
  )
}

export function OjasSpeaker({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const cone = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!body.current) return
    const s = useStore.getState()
    let kick = 0
    if (engine.started && !engine.beatPaused && !s.settings.reduceMotion) kick = Math.exp(-(engine.beatNow() % 1) * 9)
    // the whole speaker pumps on the kick, scaling from the floor
    const k = 1 + kick * 0.022
    body.current.scale.set(k, 1 + kick * 0.01, k)
  })

  const y0 = STAND
  return (
    <group position={position} rotation-y={rotation}>
      <group ref={body}>
      {/* open birch stand: a top board on two plywood sides, same build as the cabinet */}
      <Panel size={[T, STAND - T, D - 0.04]} position={[-(W / 2 - 0.05), (STAND - T) / 2, 0]} vertical />
      <Panel size={[T, STAND - T, D - 0.04]} position={[W / 2 - 0.05, (STAND - T) / 2, 0]} vertical />
      <Panel size={[W - 0.06, T, D - 0.04]} position={[0, STAND - T / 2, 0]} vertical={false} />

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
    </group>
  )
}
