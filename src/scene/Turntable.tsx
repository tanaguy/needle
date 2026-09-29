import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { deck, engine, TURN } from '../audio/engine'
import { useStore } from '../store'
import { P } from '../palette'
import { flat } from './materials'
import { useFontsReady } from './useFontsReady'

// Local layout (metres). Origin = centre of the plinth footprint, y = table top.
const W = 0.45
const D = 0.36
const FOOT = 0.018
const BODY = 0.07
const TOP = FOOT + BODY // plinth top surface
const PC: [number, number] = [-0.03, 0.02] // platter centre (x, z)
const PR = 0.155
const PLATTER_H = 0.02
const REC_Y = TOP + PLATTER_H + 0.004 // record surface
const PIVOT: [number, number] = [0.175, -0.13]
const ARM_L = 0.235

// swing angle that lands the stylus on the lead-in groove
const PLAY_ANGLE = (() => {
  let best = 0
  let err = 1e9
  for (let a = 0; a < 1.2; a += 0.001) {
    const hx = PIVOT[0] - Math.sin(a) * ARM_L
    const hz = PIVOT[1] + Math.cos(a) * ARM_L
    const e = Math.abs(Math.hypot(hx - PC[0], hz - PC[1]) - 0.128)
    if (e < err) {
      err = e
      best = a
    }
  }
  return best
})()

function labelTexture(kind: 'scratch' | 'beat', ready: boolean) {
  const c = document.createElement('canvas')
  const S = 512
  c.width = c.height = S
  const g = c.getContext('2d')!
  g.fillStyle = kind === 'scratch' ? P.offwhite : P.teal
  g.beginPath()
  g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2)
  g.fill()
  const ink = kind === 'scratch' ? '#2B2A28' : P.offwhite
  g.strokeStyle = ink
  g.globalAlpha = 0.5
  g.lineWidth = 2
  g.beginPath()
  g.arc(S / 2, S / 2, S / 2 - 26, 0, Math.PI * 2)
  g.stroke()
  g.globalAlpha = 1
  g.fillStyle = ink
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const serif = ready ? '"Instrument Serif", Georgia, serif' : 'Georgia, serif'
  const sans = ready ? 'Inter, sans-serif' : 'sans-serif'
  g.font = `italic 108px ${serif}`
  g.fillText(kind === 'scratch' ? 'Needle' : 'Loops', S / 2, S / 2 - 70)
  g.font = `500 22px ${sans}`
  g.letterSpacing = '6px'
  g.fillText(kind === 'scratch' ? 'SIDE A  ·  BATTLE TOOLS' : 'SIDE B  ·  BREAKS', S / 2, S / 2 + 92)
  g.fillText('33⅓', S / 2, S / 2 + 140)
  return new THREE.CanvasTexture(c)
}

function Vinyl({ kind }: { kind: 'scratch' | 'beat' }) {
  const ready = useFontsReady()
  const tex = useMemo(() => {
    const t = labelTexture(kind, ready)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [kind, ready])
  const rings = [
    [0.056, 0.066, '#232220'],
    [0.07, 0.098, '#1f1e1c'],
    [0.101, 0.124, '#252422'],
    [0.127, 0.147, '#1f1e1c'],
  ] as const
  return (
    <group>
      {/* slipmat */}
      <mesh position-y={0.0015} receiveShadow castShadow material={flat(P.charcoal, { rough: 1 })}>
        <cylinderGeometry args={[0.151, 0.151, 0.003, 64]} />
      </mesh>
      {/* disc */}
      <mesh position-y={0.004} receiveShadow castShadow material={flat('#1a1918', { rough: 0.4, smooth: true })}>
        <cylinderGeometry args={[0.149, 0.149, 0.002, 64]} />
      </mesh>
      {rings.map(([a, b, c], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position-y={0.0052} receiveShadow material={flat(c, { rough: 0.35, smooth: true })}>
          <ringGeometry args={[a, b, 64]} />
        </mesh>
      ))}
      {/* label */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.0054} receiveShadow>
        <circleGeometry args={[0.052, 48]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
      {/* cue sticker — the one loud colour in the room */}
      {kind === 'scratch' && (
        <mesh position={[0, 0.0062, -0.074]} castShadow material={flat(P.terracotta, { rough: 0.6, emissive: P.terracotta, ei: 0.12 })}>
          <boxGeometry args={[0.0075, 0.0014, 0.064]} />
        </mesh>
      )}
      {/* spindle */}
      <mesh position-y={0.009} material={flat(P.metal, { rough: 0.3, metal: 0.6, smooth: true })}>
        <cylinderGeometry args={[0.0035, 0.0035, 0.012, 12]} />
      </mesh>
    </group>
  )
}

function Tonearm({ playing }: { playing: () => boolean }) {
  const swing = useRef<THREE.Group>(null)
  const lift = useRef<THREE.Group>(null)
  const metal = flat(P.metal, { rough: 0.35, metal: 0.5, smooth: true })
  useFrame((_, dt) => {
    const on = playing()
    if (swing.current) swing.current.rotation.y = THREE.MathUtils.damp(swing.current.rotation.y, on ? -PLAY_ANGLE : 0.02, 3, dt)
    if (lift.current) lift.current.rotation.x = THREE.MathUtils.damp(lift.current.rotation.x, on ? 0.035 : -0.02, 4, dt)
  })
  return (
    <group position={[PIVOT[0], TOP, PIVOT[1]]}>
      <mesh position-y={0.006} castShadow receiveShadow material={flat(P.charcoalHi)}>
        <cylinderGeometry args={[0.032, 0.034, 0.012, 24]} />
      </mesh>
      <mesh position-y={0.025} castShadow material={metal}>
        <cylinderGeometry args={[0.012, 0.014, 0.03, 16]} />
      </mesh>
      {/* arm rest */}
      <mesh position={[0.012, 0.018, 0.2]} castShadow material={flat(P.charcoalHi)}>
        <cylinderGeometry args={[0.005, 0.006, 0.036, 8]} />
      </mesh>
      <group ref={swing} position-y={0.038}>
        <group ref={lift}>
          {/* counterweight */}
          <mesh position={[0, 0, -0.045]} rotation-x={Math.PI / 2} castShadow material={metal}>
            <cylinderGeometry args={[0.015, 0.015, 0.03, 18]} />
          </mesh>
          {/* tube */}
          <mesh position={[0, 0, ARM_L / 2 - 0.02]} rotation-x={Math.PI / 2} castShadow material={metal}>
            <cylinderGeometry args={[0.0035, 0.0035, ARM_L - 0.02, 10]} />
          </mesh>
          {/* headshell */}
          <group position={[-0.006, -0.01, ARM_L]} rotation-y={0.35}>
            <mesh castShadow material={flat(P.offwhite)}>
              <boxGeometry args={[0.017, 0.005, 0.036]} />
            </mesh>
            <mesh position={[0, -0.007, 0.004]} castShadow material={flat(P.charcoal)}>
              <boxGeometry args={[0.013, 0.01, 0.018]} />
            </mesh>
            <mesh position={[0.012, 0.001, -0.004]} castShadow material={flat(P.offwhite)}>
              <boxGeometry args={[0.012, 0.002, 0.004]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

function StrobeDots() {
  const n = 60
  const geom = useMemo(() => new THREE.BoxGeometry(0.004, 0.006, 0.0025), [])
  const mat = flat(P.charcoalHi, { rough: 0.6 })
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2
        return (
          <mesh
            key={i}
            geometry={geom}
            material={mat}
            position={[Math.sin(a) * (PR + 0.0008), PLATTER_H / 2, Math.cos(a) * (PR + 0.0008)]}
            rotation-y={a}
          />
        )
      })}
    </group>
  )
}

type Props = { kind: 'scratch' | 'beat'; position: [number, number, number] }

export function Turntable({ kind, position }: Props) {
  const spin = useRef<THREE.Group>(null)
  const strobe = useRef<THREE.MeshStandardMaterial>(null)

  const playing = () => (kind === 'beat' ? true : useStore.getState().phase !== 'title' && useStore.getState().phase !== 'loading')

  useFrame((state) => {
    if (!spin.current) return
    let turns: number
    if (kind === 'beat') {
      const t = engine.ctx && engine.started ? engine.ctx.currentTime : state.clock.elapsedTime * 0.25
      turns = t / TURN
    } else if (engine.started) {
      turns = engine.platterNow() / TURN
    } else {
      turns = state.clock.elapsedTime * 0.08 // idle title spin
    }
    spin.current.rotation.y = -turns * Math.PI * 2
    if (strobe.current) {
      // the strobe "locks" when the record runs at motor speed
      const v = kind === 'beat' ? 1 : engine.started ? Math.abs(deck.vel) : 0
      const lock = Math.max(0, 1 - Math.abs(v - 1) * 6)
      strobe.current.emissiveIntensity = 0.4 + lock * 1.4
    }
  })

  const plinth = flat(P.charcoal, { rough: 0.7 })
  const panel = flat(P.charcoalHi, { rough: 0.6 })
  const metal = flat(P.metal, { rough: 0.35, metal: 0.4, smooth: true })

  return (
    <group position={position}>
      {/* feet */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * (W / 2 - 0.04), FOOT / 2, sz * (D / 2 - 0.04)]} castShadow material={flat(P.charcoalHi)}>
          <cylinderGeometry args={[0.026, 0.03, FOOT, 16]} />
        </mesh>
      ))}
      <RoundedBox args={[W, BODY, D]} radius={0.012} smoothness={2} position-y={FOOT + BODY / 2} castShadow receiveShadow material={plinth} />
      <mesh position-y={TOP + 0.0005} receiveShadow material={panel}>
        <boxGeometry args={[W - 0.016, 0.001, D - 0.016]} />
      </mesh>

      {/* platter + record */}
      <group position={[PC[0], TOP, PC[1]]}>
        <mesh position-y={0.002} material={flat(P.charcoal)}>
          <cylinderGeometry args={[0.03, 0.03, 0.004, 16]} />
        </mesh>
        <group ref={spin} position-y={0.004}>
          <mesh position-y={PLATTER_H / 2} castShadow receiveShadow material={metal}>
            <cylinderGeometry args={[PR, PR - 0.002, PLATTER_H, 64]} />
          </mesh>
          <StrobeDots />
          <group position-y={PLATTER_H}>
            <Vinyl kind={kind} />
          </group>
        </group>
        {/* fixed sheen — light on vinyl stays put while the record turns */}
        <mesh rotation-x={-Math.PI / 2} position-y={REC_Y - TOP + 0.0036}>
          <ringGeometry args={[0.058, 0.147, 48, 1, Math.PI * 0.18, Math.PI * 0.16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.07} depthWrite={false} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position-y={REC_Y - TOP + 0.0036}>
          <ringGeometry args={[0.058, 0.147, 48, 1, Math.PI * 1.18, Math.PI * 0.16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.05} depthWrite={false} />
        </mesh>
      </group>

      <Tonearm playing={playing} />

      {/* start/stop + speed buttons */}
      <mesh position={[-0.185, TOP + 0.004, 0.145]} castShadow material={panel}>
        <boxGeometry args={[0.05, 0.008, 0.036]} />
      </mesh>
      <mesh position={[-0.125, TOP + 0.003, 0.155]} castShadow material={panel}>
        <boxGeometry args={[0.022, 0.006, 0.014]} />
      </mesh>
      <mesh position={[-0.098, TOP + 0.003, 0.155]} castShadow material={panel}>
        <boxGeometry args={[0.022, 0.006, 0.014]} />
      </mesh>
      {/* strobe lamp */}
      <mesh position={[-0.2, TOP + 0.006, -0.13]}>
        <cylinderGeometry args={[0.009, 0.011, 0.012, 12]} />
        <meshStandardMaterial ref={strobe} color={P.lamp} emissive={P.lamp} emissiveIntensity={0.6} />
      </mesh>
      {/* pitch fader */}
      <mesh position={[0.19, TOP + 0.0008, 0.07]} material={flat('#1f1e1c')}>
        <boxGeometry args={[0.006, 0.002, 0.11]} />
      </mesh>
      <mesh position={[0.19, TOP + 0.007, 0.07]} castShadow material={flat(P.offwhite)}>
        <boxGeometry args={[0.022, 0.012, 0.012]} />
      </mesh>
    </group>
  )
}
