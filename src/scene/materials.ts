import * as THREE from 'three'
import { P } from '../palette'

const cache = new Map<string, THREE.MeshStandardMaterial>()

/** Flat-shaded matte material, cached per colour/variant. */
export function flat(color: string, opts: { rough?: number; metal?: number; smooth?: boolean; emissive?: string; ei?: number } = {}) {
  const { rough = 0.82, metal = 0, smooth = false, emissive, ei = 0 } = opts
  const key = `${color}|${rough}|${metal}|${smooth}|${emissive}|${ei}`
  let m = cache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: rough,
      metalness: metal,
      flatShading: !smooth,
      emissive: emissive ?? '#000000',
      emissiveIntensity: ei,
    })
    cache.set(key, m)
  }
  return m
}

/** Kenney kit material names → our palette. */
export const KENNEY_REMAP: Record<string, string> = {
  wood: P.wood,
  woodDark: P.woodDark,
  carpet: P.clay,
  carpetDarker: P.terracotta,
  carpetWhite: P.offwhite,
  carpetBlue: P.teal,
  plant: P.olive,
  metal: P.metal,
  metalMedium: P.charcoalHi,
  metalDark: P.charcoal,
  lamp: P.lamp,
  fur: P.clay,
  _defaultMat: P.cream,
}
