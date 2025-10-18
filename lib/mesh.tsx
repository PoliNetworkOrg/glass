import type { ThreeElements } from "@react-three/fiber"

export type GlassMeshProps = {
  dimensions: [number, number, number]
  mesh?: ThreeElements["mesh"]
}

export function GlassMesh(props: GlassMeshProps) {
  const r = Math.min(props.dimensions[0], props.dimensions[1]) / 2

  return (
    <mesh {...props.mesh} position={[0, 0, 0]}>
      <sphereGeometry args={[r]} />
      <meshPhysicalMaterial
        roughness={1}
        transmission={0.6}
        thickness={r * 2}
        ior={1.15}
        dispersion={2}
        color={0xf8fafc}
        dithering
        emissive={0xf8fafc}
        emissiveIntensity={0.05}
        // wireframe
      />
    </mesh>
  )
}
