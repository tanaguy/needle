import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { engine } from '../audio/engine'
import { useStore } from '../store'
import { P } from '../palette'
import { flat } from './materials'

// OJAS-style birch speaker on a twin-column stand. Proportions from the Klipsch × OJAS
// kO-R2 cabinet (30.08" tall, ~23" wide, 15" woofer, slot port), scaled to 75% to sit
// in the room. Butt-joined Baltic birch: plain faces, ply layers showing on the edges.
// Metres; origin = floor, centre.
const IN = 0.0254
const SCALE = 0.75
const W = 23 * IN * SCALE // cabinet width
const H = 30.08 * IN * SCALE // cabinet height
const D = 17 * IN * SCALE // cabinet depth
const T = 0.75 * IN * SCALE // ply thickness
const STAND_H = 0.5 // floor → underside of the cabinet

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
    const face = flat(BIRCH, { rough: 0.8 })
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

const WOOFER_R = 7.5 * IN * SCALE // 15" driver (frame radius)
const WOOFER_Y = H * 0.66 // centre height, from the drawing
const PORT_W = 13 * IN * SCALE
const PORT_H = 3.4 * IN * SCALE
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
    <mesh geometry={geom} position={[0, H / 2, BF - T]} material={flat(BIRCH, { rough: 0.8 })} castShadow receiveShadow />
  )
}

function Woofer() {
  const R = WOOFER_R
  const cone = useMemo(() => new THREE.MeshStandardMaterial({ color: '#34312d', roughness: 0.95, side: THREE.DoubleSide, flatShading: true }), [])
  return (
    <group position={[0, WOOFER_Y, 0]}>
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

/** Twin-column speaker stand: black base plate on spiked feet, two slim posts, top plate. */
function Stand() {
  const black = flat('#1f1e1c', { rough: 0.55, metal: 0.3 })
  const BASE_W = W * 0.95
  const BASE_D = D * 1.0
  const PLATE = 0.012
  const FOOT = 0.025
  const TOP = 0.01
  const postH = STAND_H - FOOT - PLATE - TOP
  return (
    <group>
      {/* spiked feet with round pads */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <group key={i} position={[sx * (BASE_W / 2 - 0.02), 0, sz * (BASE_D / 2 - 0.02)]}>
          <mesh position-y={FOOT * 0.45} rotation-x={Math.PI} material={black} castShadow>
            <coneGeometry args={[0.011, FOOT * 0.9, 12]} />
          </mesh>
          <mesh position-y={FOOT - 0.003} material={black} castShadow>
            <cylinderGeometry args={[0.016, 0.016, 0.006, 16]} />
          </mesh>
        </group>
      ))}
      {/* base plate */}
      <mesh position-y={FOOT + PLATE / 2} material={black} castShadow receiveShadow>
        <boxGeometry args={[BASE_W, PLATE, BASE_D]} />
      </mesh>
      {/* two slim rectangular columns, side by side */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * 0.03, FOOT + PLATE + postH / 2, 0]} material={black} castShadow>
          <boxGeometry args={[0.032, postH, 0.045]} />
        </mesh>
      ))}
      {/* top plate the cabinet sits on */}
      <mesh position-y={STAND_H - TOP / 2} material={black} castShadow receiveShadow>
        <boxGeometry args={[W * 0.55, TOP, D * 0.6]} />
      </mesh>
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
    // the cabinet pumps on the kick, scaling from its base
    const k = 1 + kick * 0.022
    body.current.scale.set(k, 1 + kick * 0.01, k)
  })

  return (
    <group position={position} rotation-y={rotation}>
      <Stand />
      {/* the cabinet pumps on the kick; the stand stays planted */}
      <group ref={body} position-y={STAND_H}>
        {/* butt-joined birch cabinet: sides full height, top/bottom between them */}
        <Panel size={[T, H, D]} position={[-W / 2 + T / 2, H / 2, 0]} vertical />
        <Panel size={[T, H, D]} position={[W / 2 - T / 2, H / 2, 0]} vertical />
        <Panel size={[W - 2 * T, T, D]} position={[0, H - T / 2, 0]} vertical={false} />
        <Panel size={[W - 2 * T, T, D]} position={[0, T / 2, 0]} vertical={false} />
        <mesh position={[0, H / 2, -D / 2 + T / 2]} material={flat(BIRCH, { rough: 0.8 })} castShadow>
          <boxGeometry args={[W - 2 * T, H - 2 * T, T]} />
        </mesh>

        {/* birch front with the woofer and slot port cut out */}
        <Baffle />
        <Woofer />
        {/* port tunnel, dark inside */}
        <mesh position={[0, PORT_Y, BF - T - 0.04]} material={flat('#121110')}>
          <boxGeometry args={[PORT_W, PORT_H, 0.08]} />
        </mesh>
      </group>
    </group>
  )
}
