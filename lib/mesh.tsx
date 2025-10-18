import type { ThreeElements } from "@react-three/fiber"
import type { GlassOptions } from "./types/glass"

export type GlassMeshProps = {
  dimensions: [number, number, number]
  color: string
  options: GlassOptions
  mesh?: ThreeElements["mesh"]
}

export function GlassMesh(props: GlassMeshProps) {
  const { options } = props
  const r = Math.min(props.dimensions[0], props.dimensions[1]) / 2

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
