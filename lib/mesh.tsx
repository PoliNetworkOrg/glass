import type { ThreeElements } from "@react-three/fiber"
import type { GlassOptions } from "./types"

export type GlassMeshProps = {
  /** [x, y, z] dimensions of the glass mesh */
  dimensions: [number, number, number]
  /** Color of the glass material */
  color: string
  /** Glass material options */
  options: GlassOptions
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

  // Map the options to the physical material properties
  const roughness = options.frost
  const transmission = 0.1 + (1 - options.frost) * 0.9
  const thickness = options.depth * r * 2
  const ior = options.refraction
  const dispersion = options.dispersion * 10

  return (
    <mesh {...props.mesh} position={[0, 0, 0]}>
      <sphereGeometry args={[r, 64, 64]} />
      <meshPhysicalMaterial
        roughness={roughness}
        transmission={transmission}
        thickness={thickness}
        ior={ior}
        dispersion={dispersion}
        color={props.color}
        dithering
        emissive={props.color}
        emissiveIntensity={0.05}
        // wireframe
      />
    </mesh>
  )
}
