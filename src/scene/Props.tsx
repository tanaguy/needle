import { useGLTF } from '@react-three/drei'
import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { flat, KENNEY_REMAP } from './materials'
import { P } from '../palette'

export const PROP_URLS = [
  'speaker',
  'pottedPlant',
  'plantSmall1',
  'plantSmall2',
  'lampRoundFloor',
  'rugRound',
  'loungeChair',
  'bookcaseOpenLow',
  'books',
  'radio',
  'cardboardBoxOpen',
  'bear',
  'pillow',
].map((n) => `/models/${n}.glb`)

/** Kenney units are ~2 m; we build in metres. */
const K = 2

type PropProps = {
  name: string
  position?: [number, number, number]
  rotation?: number
  scale?: number
  /** override colours by Kenney material name */
  tint?: Record<string, string>
  children?: ReactNode
}

/**
 * A Kenney prop, recoloured to our palette, re-centred on its footprint so
 * `position` is where its base sits.
 */
export function Prop({ name, position = [0, 0, 0], rotation = 0, scale = 1, tint, children }: PropProps) {
  const { scene } = useGLTF(`/models/${name}.glb`)
  const obj = useMemo(() => {
    const root = scene.clone(true)
    root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      const recolor = (m: THREE.Material) => {
        const n = m.name
        const c = tint?.[n] ?? KENNEY_REMAP[n] ?? P.cream
        return n === 'lamp' ? flat(c, { emissive: P.lamp, ei: 0.9 }) : flat(c)
      }
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(recolor) : recolor(mesh.material)
    })
    const box = new THREE.Box3().setFromObject(root)
    const c = box.getCenter(new THREE.Vector3())
    root.position.set(-c.x, -box.min.y, -c.z)
    return root
  }, [scene, tint])
  const s = K * scale
  return (
    <group position={position} rotation-y={rotation}>
      <group scale={s}>
        <primitive object={obj} />
      </group>
      {children}
    </group>
  )
}

PROP_URLS.forEach((u) => useGLTF.preload(u))
