import { Preload } from "@react-three/drei"
import { Canvas } from "@react-three/fiber"
import { type MotionValue, useReducedMotion } from "motion/react"
import type { RectReadOnly } from "react-use-measure"
import type { Texture } from "three"
import { useGlass } from "./context"
import { SceneLights } from "./lights"
import { GlassMesh } from "./mesh"
import { BGPlane } from "./plane"
import { type SceneConfig, SceneConfigSchema } from "./types/schemas"
import { useMotionBounds } from "./utils/hooks"

export type GlassProps = {
  children: React.ReactNode
  /** Glass material options */
  options: Partial<SceneConfig>
  /** Color of the glass material */
  color: string
  /** Force reduce motion (disables 3D glass effect) */
  reducedMotion?: boolean
}

type Glass3DProps = {
  color: string
  options: SceneConfig
  texture: Texture
  bounds: MotionValue<RectReadOnly>
}

function Glass3D(props: Glass3DProps) {
  // const { width, height } = props.bounds
  const r = Math.min(props.bounds.get().width, props.bounds.get().height) / 2
  const width = r * 2
  const height = r * 2
  const light = props.options.lighting

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
      <SceneLights settings={light} />
      <GlassMesh color={props.color} dimensions={[width, height, 10]} options={props.options.material} />
      <BGPlane texture={props.texture} bounds={props.bounds} />
      <Preload all />
    </Canvas>
  )
}

type GlassFallbackProps = {
  color: string
  options: SceneConfig
  bounds: MotionValue<RectReadOnly>
}

function GlassFallback(props: GlassFallbackProps) {
  const { material, lighting } = props.options
  // const { width, height } = props.bounds
  const r = Math.min(props.bounds.get().width, props.bounds.get().height) / 2
  const width = r * 2
  const height = r * 2
  const blur = material.roughness * 12
  const outlineColor = `rgba(${lighting.ambient.color[0] * 255}, ${lighting.ambient.color[1] * 255}, ${lighting.ambient.color[2] * 255}, ${lighting.ambient.intensity / 10})`

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
  const options = SceneConfigSchema.parse(props.options)
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
