import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { engine } from '../audio/engine'
import { useStore } from '../store'
import { P } from '../palette'
import { flat } from './materials'
import { woodMaterial } from './wood'

// Klipsch × OJAS kO-R2-style horn speaker, to the published drawing:
//   cabinet 30.08" tall (0.764 m), ~23" wide; horn 25.38" × 14.48" (0.645 × 0.368 m),
//   15 cells (5 × 3) like the Altec 1505B it descends from; 15" woofer; slot port.
// Butt-joined Baltic birch with the ply layers showing, birch front, matte black horn.
// Metres; origin = floor, centre.
const IN = 0.0254
const W = 23 * IN // cabinet width
const H = 30.08 * IN // cabinet height
const D = 17 * IN // cabinet depth
const T = 0.75 * IN // 3/4" birch ply
const FEET = 0.02

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

const WOOFER_R = 7.5 * IN // 15" driver (frame radius)
const WOOFER_Y = H * 0.66 // centre height, from the drawing
const PORT_W = 13 * IN
const PORT_H = 3.4 * IN
const PORT_Y = H * 0.18
const BF = D / 2 // flush birch front

/** Birch front baffle with cut-outs for the woofer and the slot port. */
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
    hole.absarc(0, WOOFER_Y - H / 2, WOOFER_R - 0.012, 0, Math.PI * 2, true)
    shape.holes.push(hole)
    const port = new THREE.Path()
    const py = PORT_Y - H / 2
    port.moveTo(-PORT_W / 2, py - PORT_H / 2)
    port.lineTo(-PORT_W / 2, py + PORT_H / 2)
    port.lineTo(PORT_W / 2, py + PORT_H / 2)
    port.lineTo(PORT_W / 2, py - PORT_H / 2)
    port.lineTo(-PORT_W / 2, py - PORT_H / 2)
    shape.holes.push(port)
    // extrude UVs are in metres on the face, so the grain tiles at real scale
    return new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 48 })
  }, [])
  return (
    <mesh geometry={geom} position={[0, FEET + H / 2, BF - T]} material={woodMaterial(BIRCH, 1, 1, true)} castShadow receiveShadow />
  )
}

function Woofer() {
  const R = WOOFER_R
  const cone = useMemo(() => new THREE.MeshStandardMaterial({ color: '#34312d', roughness: 0.95, side: THREE.DoubleSide, flatShading: true }), [])
  return (
    <group position={[0, FEET + WOOFER_Y, 0]}>
      {/* basket behind the cut-out */}
      <mesh position-z={BF - 0.1} rotation-x={Math.PI / 2} material={flat('#141312')}>
        <cylinderGeometry args={[R, R, 0.01, 48]} />
      </mesh>
      {/* cast frame ring on the baffle */}
      <mesh position-z={BF + 0.003} material={flat(P.charcoal, { rough: 0.5, metal: 0.2 })}>
        <ringGeometry args={[R - 0.016, R, 48]} />
      </mesh>
      {/* rubber surround */}
      <mesh position-z={BF - 0.004} material={flat('#242321', { rough: 0.9 })}>
        <torusGeometry args={[R - 0.03, 0.014, 8, 48]} />
      </mesh>
      {/* paper cone, wide at the front, narrowing back into the box */}
      <mesh position-z={BF - 0.045} rotation-x={Math.PI / 2} material={cone}>
        <cylinderGeometry args={[R - 0.042, 0.05, 0.075, 48, 1, true]} />
      </mesh>
      {/* dust cap */}
      <mesh position-z={BF - 0.084} rotation-x={Math.PI / 2} material={flat(P.charcoal, { rough: 0.45 })}>
        <sphereGeometry args={[0.06, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* four mounting screws, as on the drawing */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sy], i) => (
        <mesh key={i} position={[sx * (R + 0.022), sy * (R + 0.022), BF + 0.002]} rotation-x={Math.PI / 2} material={flat('#3a3936', { rough: 0.4, metal: 0.5 })}>
          <cylinderGeometry args={[0.006, 0.006, 0.004, 10]} />
        </mesh>
      ))}
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
 * 15-cell multicellular horn (5 wide × 3 high), matte black. Every cell starts at one
 * throat and fans out; cell mouths meet edge-to-edge, forming the curved front.
 */
function Horn() {
  const shell = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2c2b29', roughness: 0.5, metalness: 0.2, side: THREE.FrontSide, flatShading: true }), [])
  const inner = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0c0b0a', roughness: 0.95, side: THREE.BackSide }), [])
  const rim = flat('#4a4845', { rough: 0.5, metal: 0.2 })
  const MOUTH_W = 25.38 * IN
  const MOUTH_H = 14.48 * IN
  const LEN = 0.36 // throat → mouth
  const COLS = [-2, -1, 0, 1, 2]
  const ROWS = [-1, 0, 1]
  const CW = MOUTH_W / 5 // cell mouth width
  const CH = MOUTH_H / 3
  const FAN_H = CW / LEN // radians between columns → mouths meet edge to edge
  const ROW_OFF = 0.022 // row spacing at the throat
  const FAN_V = (CH - ROW_OFF) / LEN
  const cell = useMemo(() => flareGeometry(0.03, ROW_OFF, CW, CH, LEN), [CW, CH])
  const THROAT_Y = MOUTH_H / 2 + 0.02 // lowest cells clear the cabinet top
  return (
    <group position={[0, FEET + H, 0]}>
      {/* cradle the horn rests on */}
      <mesh position={[0, 0.012, -0.08]} material={shell} castShadow receiveShadow>
        <boxGeometry args={[0.32, 0.024, 0.26]} />
      </mesh>
      <group position={[0, THROAT_Y, -0.19]}>
        {COLS.flatMap((c) =>
          ROWS.map((r) => (
            <group key={`${c}${r}`} position-y={r * ROW_OFF} rotation={[-r * FAN_V, c * FAN_H, 0]}>
              <mesh geometry={cell} position-z={LEN / 2} material={shell} castShadow />
              <mesh geometry={cell} position-z={LEN / 2} material={inner} />
              {[
                [0, CH / 2, CW + 0.006, 0.006],
                [0, -CH / 2, CW + 0.006, 0.006],
                [CW / 2, 0, 0.006, CH],
                [-CW / 2, 0, 0.006, CH],
              ].map(([x, y, w, h], i) => (
                <mesh key={i} position={[x, y, LEN]} material={rim}>
                  <boxGeometry args={[w, h, 0.008]} />
                </mesh>
              ))}
            </group>
          )),
        )}
        {/* throat block and the compression driver behind it */}
        <mesh position-z={-0.02} material={shell} castShadow>
          <boxGeometry args={[0.08, 0.1, 0.05]} />
        </mesh>
        <mesh position={[0, -THROAT_Y / 2 + 0.02, -0.02]} material={shell}>
          <boxGeometry args={[0.06, THROAT_Y - 0.04, 0.05]} />
        </mesh>
        <mesh position-z={-0.09} rotation-x={Math.PI / 2} material={flat('#161514', { rough: 0.45, metal: 0.3 })} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.1, 32]} />
        </mesh>
      </group>
    </group>
  )
}

export function OjasSpeaker({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
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

  const y0 = FEET
  return (
    <group position={position} rotation-y={rotation}>
      <group ref={body}>
        {/* small feet */}
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([sx, sz], i) => (
          <mesh key={i} position={[sx * (W / 2 - 0.05), FEET / 2, sz * (D / 2 - 0.05)]} material={flat(P.charcoal)} castShadow>
            <boxGeometry args={[0.05, FEET, 0.05]} />
          </mesh>
        ))}

        {/* butt-joined birch cabinet: sides full height, top/bottom between them */}
        <Panel size={[T, H, D]} position={[-W / 2 + T / 2, y0 + H / 2, 0]} vertical />
        <Panel size={[T, H, D]} position={[W / 2 - T / 2, y0 + H / 2, 0]} vertical />
        <Panel size={[W - 2 * T, T, D]} position={[0, y0 + H - T / 2, 0]} vertical={false} />
        <Panel size={[W - 2 * T, T, D]} position={[0, y0 + T / 2, 0]} vertical={false} />
        <mesh position={[0, y0 + H / 2, -D / 2 + T / 2]} material={woodMaterial(BIRCH, W, H)} castShadow>
          <boxGeometry args={[W - 2 * T, H - 2 * T, T]} />
        </mesh>

        {/* birch front with the woofer and slot port cut out */}
        <Baffle />
        <Woofer />
        {/* port tunnel, dark inside */}
        <mesh position={[0, y0 + PORT_Y, BF - T - 0.05]} material={flat('#121110')}>
          <boxGeometry args={[PORT_W, PORT_H, 0.1]} />
        </mesh>

        <Horn />
      </group>
    </group>
  )
}
