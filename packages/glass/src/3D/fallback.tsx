import { type MotionValue, motion, useTransform } from "motion/react"
import type { RectReadOnly } from "react-use-measure"
import type { SceneConfig } from "../types/schemas"

export type GlassFallbackProps = {
  color: string
  scene: SceneConfig
  bounds: MotionValue<RectReadOnly>
  borderRadius: number
}

export function GlassFallback(props: GlassFallbackProps) {
  const { material, lighting } = props.scene
  const width = useTransform(() => props.bounds.get().width)
  const height = useTransform(() => props.bounds.get().height)
  const blur = material.roughness ? material.roughness * 12 : 0
  const outlineColor = `rgba(${lighting.ambient.color[0] * 255}, ${lighting.ambient.color[1] * 255}, ${lighting.ambient.color[2] * 255}, ${lighting.ambient.intensity / 10})`

  return (
    <motion.div
      style={{
        width,
        height,
        margin: "auto",
        borderRadius: props.borderRadius,
        zIndex: -1,
        overflow: "hidden",
        backdropFilter: `blur(${blur}px)`,
        backgroundColor: `${props.color}CC`,
        outline: `1px solid inset ${outlineColor}`,
        boxShadow: `0 0 8px rgba(0, 0, 0, 0.1)`,
      }}
    />
  )
}
