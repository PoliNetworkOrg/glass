import type { ThreeElements } from "@react-three/fiber"

export type GlassMeshProps = {
  dimensions: [number, number, number]
  mesh?: ThreeElements["mesh"]
}

export function GlassMesh(props: GlassMeshProps) {
  return (
    <mesh {...props.mesh} position={[0, 0, 0]}>
      <boxGeometry args={props.dimensions} />
      <meshStandardMaterial color={"#00ffff"} />
    </mesh>
  )
}
