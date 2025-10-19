import { Preload } from "@react-three/drei"
import { Canvas } from "@react-three/fiber"
import { type MotionValue, useReducedMotion } from "motion/react"
import type { RectReadOnly } from "react-use-measure"
import type { Texture } from "three"
import { useGlass } from "./context"
import { GlassMesh } from "./mesh"
import { BGPlane } from "./plane"
import { defaultGlassOptions, type GlassOptions } from "./types/glass"
import { useMotionBounds } from "./utils/hooks"
// import { type ElementRect, getElementRect } from "./utils/dimensions"

export type GlassProps = {
  children: React.ReactNode
  options: Partial<GlassOptions>
  color: string
  reducedMotion?: boolean
}

function dirFromAngle(angle: number): [number, number, number] {
  const rad = (angle * Math.PI) / 180
  const x = Math.sin(rad)
  const y = Math.cos(rad)
  return [x, y, 0]
}

type Glass3DProps = {
  color: string
  options: GlassOptions
  texture: Texture
  bounds: MotionValue<RectReadOnly>
}

function Glass3D(props: Glass3DProps) {
  // const { width, height } = props.bounds
  const r = Math.min(props.bounds.get().width, props.bounds.get().height) / 2
  const width = r * 2
  const height = r * 2
  const light = props.options.light

  const amb = light.strength * (1 - light.directionality)
  const dir = light.strength * light.directionality

  return (
    <Canvas
      orthographic
      flat
      fallback={<GlassFallback color={props.color} options={props.options} bounds={props.bounds} />}
      dpr={1}
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
        boxShadow: `0 0 8px rgba(0, 0, 0, 0.1)`,
      }}
    >
      <Preload all />
      <ambientLight color={light.color} intensity={amb} />
      <directionalLight color={light.color} position={dirFromAngle(light.angle)} intensity={dir} />
      <GlassMesh color={props.color} dimensions={[width, height, 10]} options={props.options} />
      <BGPlane texture={props.texture} bounds={props.bounds} />
    </Canvas>
  )
}

type GlassFallbackProps = {
  color: string
  options: GlassOptions
  bounds: MotionValue<RectReadOnly>
}

function GlassFallback(props: GlassFallbackProps) {
  // const { width, height } = props.bounds
  const r = Math.min(props.bounds.get().width, props.bounds.get().height) / 2
  const width = r * 2
  const height = r * 2
  const blur = props.options.frost * 12
  const light = props.options.light
  const outlineColor = `rgba(${light.color[0] * 255}, ${light.color[1] * 255}, ${light.color[2] * 255}, ${light.strength / 10})`

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
        backdropFilter: `blur(${blur}px)`,
        backgroundColor: `${props.color}CC`,
        outline: `1px solid ${outlineColor}`,
        boxShadow: `0 0 8px rgba(0, 0, 0, 0.1)`,
      }}
    />
  )
}

export function Glass(props: GlassProps) {
  const options = { ...defaultGlassOptions, ...props.options }
  const [ref, bounds] = useMotionBounds()
  const { texture } = useGlass()
  const reducedMotion = useReducedMotion()
  const do3D = !!texture && !props.reducedMotion && !reducedMotion

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
        }}
      >
        {do3D ? (
          <Glass3D color={props.color} options={options} texture={texture} bounds={bounds} />
        ) : (
          <GlassFallback color={props.color} options={options} bounds={bounds} />
        )}
      </div>
      {props.children}
    </div>
  )
}
