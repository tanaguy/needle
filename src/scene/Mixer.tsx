import { Html, RoundedBox } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { deck, engine } from '../audio/engine'
import { useStore } from '../store'
import { P } from '../palette'
import { flat } from './materials'
import { CHANNEL_LABEL, hover, setLevel, type Channel } from '../controls'

const W = 0.26
const D = 0.36
const H = 0.09
const TOP = 0.012 + H
const XF_TRAVEL = 0.042
const SEGS = 9

function Knob({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, TOP, z]}>
      <mesh position-y={0.008} castShadow material={flat(P.charcoal)}>
        <cylinderGeometry args={[0.011, 0.012, 0.016, 14]} />
      </mesh>
      <mesh position={[0, 0.0165, -0.006]} material={flat(P.offwhite)}>
        <boxGeometry args={[0.0018, 0.001, 0.009]} />
      </mesh>
    </group>
  )
}

export function Mixer({ position }: { position: [number, number, number] }) {
  const xf = useRef<THREE.Mesh>(null)
  const vuA = useRef<THREE.MeshStandardMaterial[]>([])
  const vuB = useRef<THREE.MeshStandardMaterial[]>([])
  const levels = useRef({ a: 0, b: 0 })

  const vuMats = useMemo(
    () => ({
      a: Array.from({ length: SEGS }, () => new THREE.MeshStandardMaterial({ color: '#1f1e1c', emissive: P.lamp, emissiveIntensity: 0 })),
      b: Array.from({ length: SEGS }, () => new THREE.MeshStandardMaterial({ color: '#1f1e1c', emissive: P.lamp, emissiveIntensity: 0 })),
    }),
    [],
  )
  vuA.current = vuMats.a
  vuB.current = vuMats.b

  useFrame((_, dt) => {
    const open = useStore.getState().faderOpen
    if (xf.current) {
      // cap snaps fast — ~30 ms — so the eye reads the cut
      xf.current.position.x = THREE.MathUtils.damp(xf.current.position.x, open ? -XF_TRAVEL : XF_TRAVEL, 34, dt)
    }
    // meters
    const a = Math.min(1, deck.peak * 1.3)
    const beatPhase = engine.started ? engine.beatNow() % 1 : 0
    const b = engine.started && !engine.beatPaused ? 0.55 + 0.4 * Math.exp(-beatPhase * 5) : 0
    const L = levels.current
    L.a = a > L.a ? a : THREE.MathUtils.damp(L.a, a, 7, dt)
    L.b = b > L.b ? b : THREE.MathUtils.damp(L.b, b, 7, dt)
    for (let i = 0; i < SEGS; i++) {
      const th = (i + 0.5) / SEGS
      vuA.current[i].emissiveIntensity = L.a > th ? (i === SEGS - 1 ? 2 : 1.1) : 0
      vuB.current[i].emissiveIntensity = L.b > th ? (i === SEGS - 1 ? 2 : 1.1) : 0
    }
  })

  const slot = flat('#1c1b19')
  const cap = flat(P.offwhite, { rough: 0.6 })

  return (
    <group position={position}>
      <mesh position-y={0.006} castShadow material={flat(P.charcoalHi)}>
        <boxGeometry args={[W - 0.03, 0.012, D - 0.03]} />
      </mesh>
      <RoundedBox args={[W, H, D]} radius={0.01} smoothness={2} position-y={0.012 + H / 2} castShadow receiveShadow material={flat(P.charcoal, { rough: 0.7 })} />
      <mesh position-y={TOP + 0.0005} receiveShadow material={flat(P.charcoalHi, { rough: 0.6 })}>
        <boxGeometry args={[W - 0.014, 0.001, D - 0.014]} />
      </mesh>

      {/* EQ knobs: two channels × 3 */}
      {[-0.045, 0.045].map((x) => [-0.14, -0.1, -0.06].map((z) => <Knob key={`${x}${z}`} x={x} z={z} />))}
      {/* gain / filter */}
      <Knob x={-0.1} z={-0.14} />
      <Knob x={0.1} z={-0.14} />

      {/* VU meters */}
      {(['a', 'b'] as const).map((ch, ci) => (
        <group key={ch} position={[ci === 0 ? -0.012 : 0.012, TOP + 0.001, -0.02]}>
          {vuMats[ch].map((m, i) => (
            <mesh key={i} position={[0, 0, -i * 0.0085]} material={m}>
              <boxGeometry args={[0.008, 0.002, 0.006]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* channel faders: A = scratch deck (left), B = beat deck (right) */}
      <LineFader x={-0.045} channel="sampleLevel" />
      <LineFader x={0.045} channel="beatLevel" />

      {/* crossfader */}
      <mesh position={[0, TOP + 0.0012, 0.135]} material={slot}>
        <boxGeometry args={[XF_TRAVEL * 2 + 0.012, 0.002, 0.005]} />
      </mesh>
      <mesh ref={xf} position={[XF_TRAVEL, TOP + 0.008, 0.135]} castShadow material={cap}>
        <boxGeometry args={[0.012, 0.014, 0.024]} />
      </mesh>
      {/* crossfader scale ticks */}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[-XF_TRAVEL + (i * XF_TRAVEL * 2) / 6, TOP + 0.0008, 0.155]} material={flat(P.metal)}>
          <boxGeometry args={[0.0012, 0.001, 0.006]} />
        </mesh>
      ))}
    </group>
  )
}

// Fader travel along the slot (local z). Up = away from you = louder.
const Z_LOUD = 0.011
const Z_QUIET = 0.089
const zOf = (v: number) => Z_QUIET - v * (Z_QUIET - Z_LOUD)
const plane = new THREE.Plane()
const hit = new THREE.Vector3()

function LineFader({ x, channel }: { x: number; channel: Channel }) {
  const level = useStore((s) => s.settings[channel])
  const capRef = useRef<THREE.Mesh>(null)
  const group = useRef<THREE.Group>(null)
  const [hot, setHot] = useState(false)
  const [held, setHeld] = useState(false)
  const [recent, setRecent] = useState(false)

  // keep the label up for a moment after a scroll adjustment
  useEffect(() => {
    if (!hover.lastAdjust[channel]) return
    setRecent(true)
    const id = setTimeout(() => setRecent(false), 900)
    return () => clearTimeout(id)
  }, [level, channel])

  useFrame((_, dt) => {
    if (capRef.current) capRef.current.position.z = THREE.MathUtils.damp(capRef.current.position.z, zOf(level), 30, dt)
  })

  const setFromRay = (e: ThreeEvent<PointerEvent>) => {
    const g = group.current
    if (!g) return
    const top = new THREE.Vector3(0, TOP, 0)
    g.localToWorld(top)
    plane.set(new THREE.Vector3(0, 1, 0), -top.y)
    if (!e.ray.intersectPlane(plane, hit)) return
    g.worldToLocal(hit)
    setLevel(channel, (Z_QUIET - hit.z) / (Z_QUIET - Z_LOUD))
  }

  const end = (e: ThreeEvent<PointerEvent>) => {
    if (hover.held !== channel) return
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
    hover.held = null
    setHeld(false)
    if (!hot) document.body.style.cursor = ''
  }

  const capMat = hot || held ? flat('#FFFFFF', { rough: 0.5, emissive: P.offwhite, ei: 0.35 }) : flat(P.offwhite, { rough: 0.6 })

  return (
    <group ref={group}>
      <mesh position={[x, TOP + 0.0012, 0.05]} material={flat('#1c1b19')}>
        <boxGeometry args={[0.005, 0.002, 0.09]} />
      </mesh>
      {/* scale ticks */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[x + 0.013, TOP + 0.0008, Z_LOUD + (i * (Z_QUIET - Z_LOUD)) / 5]} material={flat(P.metal)}>
          <boxGeometry args={[0.005, 0.001, 0.0012]} />
        </mesh>
      ))}
      <mesh ref={capRef} position={[x, TOP + 0.007, zOf(level)]} castShadow material={capMat}>
        <boxGeometry args={[0.02, 0.012, 0.012]} />
      </mesh>
      {/* generous invisible hit area over the whole slot */}
      <mesh
        position={[x, TOP + 0.01, 0.05]}
        onPointerOver={(e) => {
          e.stopPropagation()
          hover.over = channel
          setHot(true)
          document.body.style.cursor = 'ns-resize'
        }}
        onPointerOut={() => {
          if (hover.over === channel) hover.over = null
          setHot(false)
          if (hover.held !== channel) document.body.style.cursor = ''
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.stopPropagation()
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
          hover.held = channel
          setHeld(true)
          setFromRay(e)
        }}
        onPointerMove={(e) => {
          if (hover.held === channel) setFromRay(e)
        }}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <boxGeometry args={[0.04, 0.03, 0.11]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {(hot || held || recent) && (
        <Html position={[x, TOP + 0.03, zOf(level) - 0.02]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div className="fader-tip">
            <span className="label">{CHANNEL_LABEL[channel]}</span>
            <span className="mono">{Math.round(level * 100)}%</span>
          </div>
        </Html>
      )}
    </group>
  )
}
