import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { engine } from '../audio/engine'
import { useStore } from '../store'
import { P } from '../palette'
import { flat } from './materials'
import { Mixer } from './Mixer'
import { Prop } from './Props'
import { Turntable } from './Turntable'

export const TABLE_Y = 0.9
export const SCRATCH_POS: [number, number, number] = [-0.4, TABLE_Y, 0.02]
export const MIXER_POS: [number, number, number] = [0, TABLE_Y, 0.02]
export const BEAT_POS: [number, number, number] = [0.4, TABLE_Y, 0.02]

const R = 2.7 // platform radius

function Platform() {
  const mats = useMemo(() => [flat(P.sandSide), flat(P.sand), flat(P.sandSide)], [])
  return (
    <group>
      <mesh position-y={-0.2} receiveShadow material={mats}>
        <cylinderGeometry args={[R, R * 0.97, 0.4, 40]} />
      </mesh>
      {/* a thin lip gives the diorama a crisp edge */}
      <mesh position-y={-0.43} material={flat(P.woodDark)}>
        <cylinderGeometry args={[R * 0.97, R * 0.9, 0.06, 40]} />
      </mesh>
    </group>
  )
}

function Table() {
  const wood = flat(P.wood)
  const dark = flat(P.woodDark)
  const L = 1.5
  const Dp = 0.66
  return (
    <group>
      <mesh position-y={TABLE_Y - 0.025} castShadow receiveShadow material={wood}>
        <boxGeometry args={[L, 0.05, Dp]} />
      </mesh>
      {/* apron */}
      <mesh position={[0, TABLE_Y - 0.08, 0]} castShadow material={dark}>
        <boxGeometry args={[L - 0.1, 0.06, Dp - 0.1]} />
      </mesh>
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * (L / 2 - 0.07), (TABLE_Y - 0.05) / 2, sz * (Dp / 2 - 0.07)]} castShadow receiveShadow material={dark}>
          <boxGeometry args={[0.055, TABLE_Y - 0.05, 0.055]} />
        </mesh>
      ))}
      {/* lower shelf with records */}
      <mesh position-y={0.22} castShadow receiveShadow material={wood}>
        <boxGeometry args={[L - 0.1, 0.03, Dp - 0.12]} />
      </mesh>
      <Sleeves count={16} position={[-0.25, 0.235, 0]} seed={3} />
      <Sleeves count={9} position={[0.42, 0.235, 0]} seed={11} lean={-0.28} />
    </group>
  )
}

const SLEEVE_COLORS = [P.offwhite, P.teal, P.olive, P.clay, P.charcoal, P.cream, P.tealDark, P.sandSide, P.oliveDark, '#D8B25A']

function rng(seed: number) {
  let s = seed * 9301 + 49297
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

/** A row of record sleeves standing on edge. */
function Sleeves({ count, position, seed, lean = 0.12 }: { count: number; position: [number, number, number]; seed: number; lean?: number }) {
  const items = useMemo(() => {
    const r = rng(seed)
    return Array.from({ length: count }, (_, i) => ({
      x: i * 0.018 - (count * 0.018) / 2,
      c: SLEEVE_COLORS[Math.floor(r() * SLEEVE_COLORS.length)],
      tilt: (r() - 0.5) * 0.08 + lean * (i === count - 1 ? 2.2 : 0.3),
      h: 0.31 - r() * 0.01,
    }))
  }, [count, seed, lean])
  return (
    <group position={position}>
      {items.map((it, i) => (
        <mesh key={i} position={[it.x, it.h / 2, 0]} rotation-z={it.tilt} castShadow receiveShadow material={flat(it.c)}>
          <boxGeometry args={[0.012, it.h, 0.31]} />
        </mesh>
      ))}
    </group>
  )
}

function Crate({ position, rotation = 0, seed }: { position: [number, number, number]; rotation?: number; seed: number }) {
  const wood = flat(P.clay)
  const w = 0.36
  const d = 0.36
  const h = 0.3
  const t = 0.018
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position-y={t / 2} castShadow receiveShadow material={wood}>
        <boxGeometry args={[w, t, d]} />
      </mesh>
      {[
        [0, -d / 2 + t / 2, w, t],
        [0, d / 2 - t / 2, w, t],
      ].map(([x, z, sx, sz], i) => (
        <mesh key={i} position={[x, h / 2, z]} castShadow receiveShadow material={wood}>
          <boxGeometry args={[sx, h, sz]} />
        </mesh>
      ))}
      {[-w / 2 + t / 2, w / 2 - t / 2].map((x, i) => (
        <mesh key={i} position={[x, h * 0.4, 0]} castShadow receiveShadow material={wood}>
          <boxGeometry args={[t, h * 0.8, d]} />
        </mesh>
      ))}
      <group rotation-y={Math.PI / 2}>
        <Sleeves count={15} position={[0, t, 0]} seed={seed} />
      </group>
    </group>
  )
}

function Headphones({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const band = flat(P.charcoal)
  const cup = flat(P.charcoalHi)
  const pad = flat(P.cream)
  return (
    <group position={position} rotation-y={rotation}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.012} castShadow material={band}>
        <torusGeometry args={[0.075, 0.008, 6, 20, Math.PI]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.075, 0.022, 0.012]}>
          <mesh castShadow material={cup}>
            <cylinderGeometry args={[0.038, 0.038, 0.034, 20]} />
          </mesh>
          <mesh position-y={0.02} material={pad}>
            <cylinderGeometry args={[0.03, 0.03, 0.006, 20]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Cable() {
  // a lazy cable from the mixer to the floor
  const geom = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.05, TABLE_Y + 0.05, -0.18),
      new THREE.Vector3(0.1, TABLE_Y + 0.02, -0.34),
      new THREE.Vector3(0.18, TABLE_Y - 0.2, -0.36),
      new THREE.Vector3(0.3, 0.2, -0.4),
      new THREE.Vector3(0.55, 0.012, -0.5),
      new THREE.Vector3(0.95, 0.012, -0.4),
    ])
    return new THREE.TubeGeometry(curve, 48, 0.006, 6, false)
  }, [])
  return <mesh geometry={geom} castShadow material={flat(P.charcoal)} />
}

/** Beat-driven life: speakers pump, lamp breathes, plant sways. */
function useBeatPulse() {
  return () => {
    if (!engine.started || engine.beatPaused) return { kick: 0, bar: 0 }
    const b = engine.beatNow()
    const reduce = useStore.getState().settings.reduceMotion
    const kick = reduce ? 0 : Math.exp(-(b % 1) * 9)
    const bar = reduce ? 0 : Math.exp(-((b % 4) / 4) * 5)
    return { kick, bar }
  }
}

function Speaker({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const g = useRef<THREE.Group>(null)
  const pulse = useBeatPulse()
  useFrame(() => {
    if (!g.current) return
    const { kick } = pulse()
    const s = 1 + kick * 0.022
    g.current.scale.set(s, 1 + kick * 0.01, s)
  })
  return (
    <group ref={g} position={position}>
      <Prop name="speaker" rotation={rotation} tint={{ wood: P.charcoalHi, metalMedium: P.charcoal }} />
    </group>
  )
}

function Lamp({ position }: { position: [number, number, number] }) {
  const light = useRef<THREE.PointLight>(null)
  const pulse = useBeatPulse()
  useFrame(() => {
    if (!light.current) return
    light.current.intensity = 1.6 + pulse().bar * 0.9
  })
  return (
    <group position={position}>
      <Prop name="lampRoundFloor" rotation={Math.PI * 0.8} />
      <pointLight ref={light} position={[0, 1.55, 0.05]} color={P.lamp} intensity={1.6} distance={3.2} decay={1.6} />
    </group>
  )
}

function Plant({ position, name = 'pottedPlant', scale = 1.25 }: { position: [number, number, number]; name?: string; scale?: number }) {
  const g = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (!g.current || useStore.getState().settings.reduceMotion) return
    g.current.rotation.z = Math.sin(s.clock.elapsedTime * 0.7) * 0.012
    g.current.rotation.x = Math.sin(s.clock.elapsedTime * 0.53 + 1) * 0.01
  })
  return (
    <group ref={g} position={position}>
      <Prop name={name} scale={scale} tint={{ wood: P.clay, woodDark: P.woodDark }} />
    </group>
  )
}

/** Dust in the sunbeam — only in the wide shots; up close it reads as glare. */
function Dust() {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!g.current) return
    const s = useStore.getState()
    g.current.visible = !s.settings.reduceMotion && (s.phase === 'title' || s.phase === 'loading' || (s.phase === 'session' && s.settings.camera === 'room'))
  })
  return (
    <group ref={g}>
      <Sparkles count={40} scale={[4, 1.6, 4]} position={[0, 1.9, 0]} size={3} speed={0.18} opacity={0.5} color={P.lamp} noise={0.6} />
    </group>
  )
}

export function Diorama() {
  return (
    <group>
      <Platform />
      <Prop name="rugRound" position={[0, 0.001, 0.15]} scale={1.35} tint={{ carpet: P.cream, carpetDarker: P.olive }} />

      <Table />
      <Turntable kind="scratch" position={SCRATCH_POS} />
      <Mixer position={MIXER_POS} />
      <Turntable kind="beat" position={BEAT_POS} />
      <Headphones position={[0.66, TABLE_Y, -0.2]} rotation={0.5} />
      <Cable />

      <Speaker position={[-1.02, 0, -0.42]} rotation={0} />
      <Speaker position={[1.02, 0, -0.42]} rotation={0} />

      <Crate position={[-1.35, 0, 0.55]} rotation={0.25} seed={5} />
      <Crate position={[-0.95, 0, 1.05]} rotation={-0.35} seed={9} />
      <Prop name="cardboardBoxOpen" position={[-1.7, 0, -0.2]} rotation={0.6} scale={1} tint={{ wood: P.cream, woodDark: P.sandSide }} />

      <Plant position={[-1.9, 0, -1.1]} scale={1.05} />
      <Lamp position={[1.85, 0, -1.0]} />

      <group position={[1.7, 0, 0.85]} rotation-y={-2.2}>
        <Prop name="loungeChair" scale={0.78} tint={{ carpet: P.teal, wood: P.woodDark }} />
        <Prop name="bear" position={[0.02, 0.29, 0.04]} scale={0.62} tint={{ fur: P.clay, wood: P.cream, metalDark: P.charcoal }} />
      </group>

      <group position={[0.35, 0, -1.8]}>
        <Prop name="bookcaseOpenLow" scale={1.15} tint={{ wood: P.wood }} />
        <Prop name="books" position={[-0.22, 0.92, 0]} scale={1.1} tint={{ carpetDarker: P.teal, plant: P.olive, metal: P.cream }} />
        <Prop name="radio" position={[0.18, 0.92, 0]} rotation={0.15} scale={0.85} tint={{ metalMedium: P.charcoalHi, wood: P.clay }} />
      </group>
      <Plant name="plantSmall2" position={[-0.55, 0, -1.75]} scale={1.6} />

      <Dust />
    </group>
  )
}
