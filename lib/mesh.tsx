import type { ThreeElements } from "@react-three/fiber"

export type GlassMeshProps = {
  dimensions: [number, number, number]
  mesh?: ThreeElements["mesh"]
}

export function GlassMesh(props: GlassMeshProps) {
  return (
    <mesh {...props.mesh} position={[0, 0, 0]}>
      <sphereGeometry args={[props.dimensions[0] / 4]} />
      <meshPhysicalMaterial
        roughness={0.4}
        transmission={1}
        thickness={10}
        ior={1}
        reflectivity={0.7}
        dispersion={10}
        emissive={0xffffff}
        emissiveIntensity={0.1}
        toneMapped={false}
      />
    </mesh>
  )
}
