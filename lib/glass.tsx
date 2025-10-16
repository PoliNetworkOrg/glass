import { Canvas } from "@react-three/fiber"
import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { OrthographicCamera, type Texture } from "three"
import { useGlass } from "./context"
import { GlassMesh } from "./mesh"
import type { GlassOptions } from "./types/glass"

export type GlassProps = {
  children: React.ReactNode
  options: Partial<GlassOptions>
} & React.HTMLAttributes<HTMLDivElement>

function Glass3D(props: { texture: Texture }) {
  const canv = useRef<HTMLCanvasElement>(null)

  const [dimensions, setDimensions] = useState<[number, number]>([100, 100])
  useLayoutEffect(() => {
    if (canv.current) {
      setDimensions([canv.current.clientWidth, canv.current.clientHeight])
    }
  }, [canv.current])
  const [width, height] = dimensions
  const camera = useMemo(() => {
    const camera = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 1000)
    camera.position.set(0, 0, 500)
    camera.lookAt(0, 0, 0)
    return camera
  }, [width, height])

  return (
    <Canvas
      camera={camera}
      ref={canv}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
        overflow: "hidden",
      }}
    >
      <ambientLight intensity={Math.PI / 2} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
      <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
      <GlassMesh dimensions={[width, height, 1]} />
      <mesh position={[1, 1, 1]}>
        <planeGeometry args={[width / 2, height / 2, 1]} />
        <meshBasicMaterial map={props.texture} />
      </mesh>
    </Canvas>
  )
}

function GlassFallback() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
      }}
    />
  )
}

export function Glass(props: GlassProps) {
  // const { options } = props
  const { texture } = useGlass()

  return (
    <div
      {...props}
      style={{
        display: "flex",
        position: "relative",
        overflow: "hidden",
        zIndex: 1,
        ...props.style,
      }}
      glass-ignore
    >
      {texture ? <Glass3D texture={texture} /> : <GlassFallback />}
      {props.children}
    </div>
  )
}
