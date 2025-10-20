import * as THREE from "three"
import type { SceneConfig } from "../types/schemas" // import your schema types

export function createPhysicalMaterialParams(
  materialConfig: SceneConfig["material"],
  maxDepth: number
): THREE.MeshPhysicalMaterialParameters {
  const m = materialConfig

  const params: THREE.MeshPhysicalMaterialParameters = {
    color: new THREE.Color(...m.color),
    roughness: m.roughness,
    ior: m.ior,
    reflectivity: m.reflectivity,
    dispersion: m.dispersion,
  }

  // --- Metalness ---
  if (m.metalness.enabled) {
    params.metalness = m.metalness.strength
  }

  // --- Clearcoat ---
  if (m.clearcoat?.enabled) {
    params.clearcoat = m.clearcoat.strength
    params.clearcoatRoughness = m.clearcoat.roughness
  }

  // --- Sheen ---
  if (m.sheen?.enabled) {
    params.sheenColor = new THREE.Color(...m.sheen.color)
    params.sheenRoughness = m.sheen.roughness
  }

  // --- Transmission ---
  if (m.transmission?.enabled) {
    params.transmission = m.transmission.value
    params.thickness = maxDepth * m.transmission.thickness
    params.attenuationColor = new THREE.Color(...m.transmission.attenuationColor)
    params.attenuationDistance = m.transmission.attenuationDistance
  }

  // --- Iridescence ---
  if (m.iridescence?.enabled) {
    params.iridescence = m.iridescence.strength
    params.iridescenceIOR = m.iridescence.ior
  }

  // --- Emissive ---
  if (m.emissive?.enabled) {
    params.emissive = new THREE.Color(...m.emissive.color)
    params.emissiveIntensity = m.emissive.intensity
  }

  return params
}
