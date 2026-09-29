import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { deck, engine } from '../audio/engine'
import { useStore } from '../store'
import { P } from '../palette'
import { flat } from './materials'

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
    const b = engine.started ? 0.55 + 0.4 * Math.exp(-beatPhase * 5) : 0
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

      {/* line faders */}
      {[-0.045, 0.045].map((x) => (
        <group key={x}>
          <mesh position={[x, TOP + 0.0012, 0.05]} material={slot}>
            <boxGeometry args={[0.005, 0.002, 0.09]} />
          </mesh>
          <mesh position={[x, TOP + 0.007, 0.018]} castShadow material={cap}>
            <boxGeometry args={[0.02, 0.012, 0.012]} />
          </mesh>
        </group>
      ))}

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
