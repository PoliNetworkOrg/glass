import { type MotionValue, motion, useTransform } from "motion/react"
import type { RectReadOnly } from "react-use-measure"
import type { SceneConfig } from "../types/schemas"

export type GlassFallbackProps = {
  color: string
  scene: SceneConfig
  bounds: MotionValue<RectReadOnly>
  borderRadius: number
  /** Superellipse exponent of the corners */
  cornerExponent?: number
}

export function GlassFallback(props: GlassFallbackProps) {
  const { surface } = props.scene
  const width = useTransform(() => props.bounds.get().width)
  const height = useTransform(() => props.bounds.get().height)

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
