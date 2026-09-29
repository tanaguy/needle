import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, N8AO, TiltShift2, ToneMapping, Vignette, Noise, HueSaturation, BrightnessContrast, SMAA } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { Suspense, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useStore } from '../store'
import { P } from '../palette'
import { lastPlatterInput } from '../input/trackpad'
import { Diorama, SCRATCH_POS } from './Diorama'

function Lighting() {
  const quality = useStore((s) => s.settings.quality)
  const sun = useRef<THREE.DirectionalLight>(null)
  useEffect(() => {
    const l = sun.current
    if (!l) return
    l.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024)
    l.shadow.map?.dispose()
    l.shadow.map = null as unknown as THREE.WebGLRenderTarget
  }, [quality])
  return (
    <>
      <hemisphereLight args={[P.sky, P.ground, 1.25]} />
      <ambientLight intensity={0.12} />
      {/* low warm sun → long soft shadows */}
      <directionalLight
        ref={sun}
        position={[-5.2, 4.6, 3.4]}
        intensity={2.9}
        color={P.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-radius={5}
        shadow-camera-left={-3.4}
        shadow-camera-right={3.4}
        shadow-camera-top={3.4}
        shadow-camera-bottom={-3.4}
        shadow-camera-near={1}
        shadow-camera-far={16}
      />
      {/* cool sky fill from the opposite side */}
      <directionalLight position={[4, 3, -3]} intensity={0.45} color="#CFE0F0" />
    </>
  )
}

type Shot = { pos: THREE.Vector3; look: THREE.Vector3 }

const deckLook = new THREE.Vector3(SCRATCH_POS[0] + 0.17, SCRATCH_POS[1] + 0.02, SCRATCH_POS[2] + 0.02)
const SHOTS: Record<'deck' | 'room' | 'onboard', Shot> = {
  deck: { look: deckLook, pos: deckLook.clone().add(new THREE.Vector3(0.0, 1.62, 1.28)) },
  onboard: {
    look: new THREE.Vector3(SCRATCH_POS[0] - 0.03, SCRATCH_POS[1] + 0.1, SCRATCH_POS[2] + 0.02),
    pos: new THREE.Vector3(SCRATCH_POS[0] + 0.02, SCRATCH_POS[1] + 1.55, SCRATCH_POS[2] + 1.15),
  },
  room: { look: new THREE.Vector3(0, 0.05, 0.35), pos: new THREE.Vector3(5.6, 7.1, 9.2) },
}

function CameraRig() {
  const { camera, pointer } = useThree()
  const look = useRef(new THREE.Vector3().copy(SHOTS.room.look))
  const tmp = useRef(new THREE.Vector3())
  const tmpLook = useRef(new THREE.Vector3())
  const first = useRef(true)
  const shift = useRef(0)
  const shiftV = useRef(0)

  useFrame((state, dt) => {
    const s = useStore.getState()
    const cam = camera as THREE.PerspectiveCamera
    const t = state.clock.elapsedTime
    const reduce = s.settings.reduceMotion
    const target = tmp.current
    const targetLook = tmpLook.current

    const aspect = state.size.width / state.size.height
    let fov = 20
    let shiftPx = 0
    let shiftY = 0
    if (s.phase === 'loading' || s.phase === 'title') {
      // slow orbit around the diorama, framed to the right of the title text
      const a = 0.56 + (reduce ? 0 : Math.sin(t * 0.05) * 0.22)
      const r = 12.4
      target.set(Math.sin(a) * r, 8.2, Math.cos(a) * r)
      const shift = aspect > 1.25 ? 1.35 : 0.3
      targetLook.set(-Math.cos(a) * shift, 0.35, Math.sin(a) * shift)
      fov = aspect < 1.25 ? 26 : 20
    } else {
      const shot = s.phase === 'onboarding' ? SHOTS.onboard : SHOTS[s.settings.camera]
      target.copy(shot.pos)
      targetLook.copy(shot.look)
      // keep the same slice of the world in frame whatever the window shape
      const d = shot.pos.distanceTo(shot.look)
      let wantW = s.settings.camera === 'room' && s.phase === 'session' ? 6.4 : 1.12
      if (s.phase === 'onboarding') {
        // the setup card covers the left ~440px: frame the deck in what's left
        const free = Math.max(0.35, (state.size.width - 440) / state.size.width)
        wantW = 0.62 / free
        shiftPx = (state.size.width - state.size.width * free) / 2
      }
      // ...and enough height that the deck clears the HUD above and the strip below
      const wantH = s.settings.camera === 'room' && s.phase === 'session' ? 3.6 : s.phase === 'onboarding' ? 0.5 : 0.78
      const byW = 2 * Math.atan(wantW / (2 * d * aspect))
      const byH = 2 * Math.atan(wantH / (2 * d))
      fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(Math.max(byW, byH)), 14, 42)
      // the strip at the bottom is taller than the HUD at the top: nudge the subject up
      if (s.phase === 'session') shiftY = 44
      // gentle parallax when idle
      const idle = performance.now() - lastPlatterInput() > 1500 && s.settings.gesture === 'swipe'
      if (!reduce && idle && !s.panel) {
        const k = s.settings.camera === 'room' ? 0.35 : 0.05
        target.x += pointer.x * k
        target.y += pointer.y * k * 0.5
      }
    }

    const lam = first.current ? 100 : s.phase === 'session' || s.phase === 'onboarding' ? 2.2 : 1.2
    first.current = false
    cam.position.x = THREE.MathUtils.damp(cam.position.x, target.x, lam, dt)
    cam.position.y = THREE.MathUtils.damp(cam.position.y, target.y, lam, dt)
    cam.position.z = THREE.MathUtils.damp(cam.position.z, target.z, lam, dt)
    look.current.x = THREE.MathUtils.damp(look.current.x, targetLook.x, lam, dt)
    look.current.y = THREE.MathUtils.damp(look.current.y, targetLook.y, lam, dt)
    look.current.z = THREE.MathUtils.damp(look.current.z, targetLook.z, lam, dt)
    cam.lookAt(look.current)
    shift.current = THREE.MathUtils.damp(shift.current, shiftPx, lam, dt)
    shiftV.current = THREE.MathUtils.damp(shiftV.current, shiftY, lam, dt)
    const { width: w, height: h } = state.size
    if (Math.abs(shift.current) > 0.5 || Math.abs(shiftV.current) > 0.5) cam.setViewOffset(w, h, -shift.current, shiftV.current, w, h)
    else if (cam.view?.enabled) cam.clearViewOffset()
    if (Math.abs(cam.fov - fov) > 0.01) cam.fov = THREE.MathUtils.damp(cam.fov, fov, lam, dt)
    cam.updateProjectionMatrix()
  })
  return null
}

function PostFX() {
  const quality = useStore((s) => s.settings.quality)
  const reduce = useStore((s) => s.settings.reduceMotion)
  const high = quality === 'high'
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO enabled={high} aoRadius={0.45} distanceFalloff={0.6} intensity={2.4} color="#3b2f25" quality="medium" halfRes />
      <TiltShift2 blur={high && !reduce ? 0.11 : 0} taper={0.6} start={[0.5, 0.0]} end={[0.5, 1.0]} samples={high ? 10 : 4} />
      <HueSaturation saturation={0.06} />
      <BrightnessContrast brightness={0.01} contrast={0.05} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette offset={0.32} darkness={0.42} />
      <Noise premultiply opacity={0.35} blendFunction={BlendFunction.SOFT_LIGHT} />
      <SMAA />
    </EffectComposer>
  )
}

export function Stage({ onReady }: { onReady?: () => void }) {
  const quality = useStore((s) => s.settings.quality)
  return (
    <Canvas
      shadows="soft"
      dpr={quality === 'high' ? [1, 2] : 1}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 20, near: 0.1, far: 60, position: [6, 7.6, 9] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping
        onReady?.()
      }}
    >
      <color attach="background" args={[P.bg]} />
      <fog attach="fog" args={[P.bg, 16, 34]} />
      <Lighting />
      <CameraRig />
      <Suspense fallback={null}>
        <Diorama />
      </Suspense>
      <PostFX />
    </Canvas>
  )
}
