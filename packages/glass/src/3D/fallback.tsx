import { type MotionValue, motion, useTransform } from "motion/react"
import type { SceneConfig } from "../types/schemas"
import type { GlassBounds } from "../utils/hooks"

export type GlassFallbackProps = {
  color: string
  scene: SceneConfig
  bounds: MotionValue<GlassBounds>
  borderRadius: number
  /** Superellipse exponent of the corners */
  cornerExponent?: number
}

export function GlassFallback(props: GlassFallbackProps) {
  const { surface } = props.scene
  const width = useTransform(() => props.bounds.get().layoutWidth)
  const height = useTransform(() => props.bounds.get().layoutHeight)

  return (
    <motion.div
      style={{
        width,
        height,
        margin: "auto",
        borderRadius: props.borderRadius,
        zIndex: -1,
        overflow: "hidden",
        backdropFilter: `blur(${surface.frost}px)`,
        backgroundColor: `${props.color}CC`,
        boxShadow: `0 0 8px rgba(0, 0, 0, 0.1)`,
      }}
    />
  )
}
