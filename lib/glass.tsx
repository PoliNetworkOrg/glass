import { Canvas } from "@react-three/fiber"
import { useReducedMotion } from "motion/react"
import useMeasure, { type RectReadOnly } from "react-use-measure"
import type { Texture } from "three"
import { useGlass } from "./context"
import { GlassMesh } from "./mesh"
import { BGPlane } from "./plane"
import type { GlassOptions } from "./types/glass"
// import { type ElementRect, getElementRect } from "./utils/dimensions"

export type GlassProps = {
  children: React.ReactNode
  options: Partial<GlassOptions>
  reducedMotion?: boolean
}

function dirFromAngle(angle: number): [number, number, number] {
  const rad = (angle * Math.PI) / 180
  const x = Math.cos(rad)
  const y = Math.sin(rad)
  return [x, y, 0]
}

function Glass3D(props: { texture: Texture; bounds: RectReadOnly }) {
  // const { width, height } = props.bounds
  const r = Math.min(props.bounds.width, props.bounds.height) / 2
  const width = r * 2
  const height = r * 2

  return (
    <Canvas
      orthographic
      flat
      fallback={<GlassFallback bounds={props.bounds} />}
      camera={{
        position: [0, 0, 512],
        left: -width / 2,
        right: width / 2,
        top: height / 2,
        bottom: -height / 2,
        near: 0.01,
        far: 2048,
      }}
      // frameloop="demand"
      style={{
        width,
        height,
        margin: "auto",
        borderRadius: r,
        zIndex: -1,
        overflow: "hidden",
      }}
    >
      <ambientLight intensity={3} />
      <directionalLight color={0xffffff} position={dirFromAngle(45)} intensity={3} />
      <GlassMesh dimensions={[width, height, 10]} />
      <BGPlane texture={props.texture} bounds={props.bounds} />
    </Canvas>
  )
}

function GlassFallback(props: { bounds: RectReadOnly }) {
  // const { width, height } = props.bounds
  const r = Math.min(props.bounds.width, props.bounds.height) / 2
  const width = r * 2
  const height = r * 2

  return (
    <div
      glass-ignore=""
      style={{
        width,
        height,
        margin: "auto",
        borderRadius: r,
        zIndex: -1,
        overflow: "hidden",
        backdropFilter: "blur(6px)",
        backgroundColor: "#F8FAFCCC",
        outline: "1px solid white",
      }}
    />
  )
}

export function Glass(props: GlassProps) {
  // const { options } = props
  const [ref, bounds] = useMeasure({ scroll: true })
  const { texture } = useGlass()
  const reducedMotion = useReducedMotion()
  const do3D = !!texture && !props.reducedMotion && bounds.width > 0 && bounds.height > 0 && !reducedMotion

  return (
    <div
      glass-ignore=""
      style={{
        display: "flex",
        position: "relative",
        zIndex: 1,
        flex: 1,
      }}
    >
      <div
        ref={ref}
        className="glass-container"
        style={{
          position: "absolute",
          display: "flex",
          overflow: "hidden",
          justifyContent: "stretch",
          alignItems: "stretch",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: -1,
          outline: "1px solid rgba(0, 0, 0, 0.3)",
        }}
      >
        {do3D ? <Glass3D texture={texture} bounds={bounds} /> : <GlassFallback bounds={bounds} />}
      </div>
      {props.children}
    </div>
  )
}
