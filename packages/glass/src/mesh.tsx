import type { ThreeElements } from "@react-three/fiber"
import type { GlassConfig } from "./types/schemas"
import { createPhysicalMaterialParams } from "./utils/material"

export type GlassMeshProps = {
  /** [x, y, z] dimensions of the glass mesh */
  dimensions: [number, number, number]
  /** Color of the glass material */
  color: string
  /** Glass material options */
  options: GlassConfig
  /** Additional mesh props to pass to the glass mesh */
  mesh?: ThreeElements["mesh"]
}

/**
 * # GlassMesh
 * The Three.js mesh for a glass element.
 */
export function GlassMesh(props: GlassMeshProps) {
  const { options } = props
  const r = Math.min(props.dimensions[0], props.dimensions[1]) / 2 // TODO: actual pill geometry
  const materialParams = createPhysicalMaterialParams(options, r * 2)

  return (
    <mesh {...props.mesh} position={[0, 0, 0]}>
      <sphereGeometry args={[r, 256, 256]} />
      <meshPhysicalMaterial {...materialParams} dithering />
    </mesh>
  )
}
