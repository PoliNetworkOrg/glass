import { type MotionValue, motion, useTransform } from "motion/react"
import type { SceneConfig } from "../types/schemas"
import type { GlassBounds } from "../utils/hooks"
import { LIT_VAR } from "../utils/press"

export type GlassFallbackProps = {
  color: string
  scene: SceneConfig
  bounds: MotionValue<GlassBounds>
  borderRadius: number
  /** Superellipse exponent of the corners */
  cornerExponent?: number
  /** Wear the light of a pressed glass on its own, where its parent doesn't (see `lit` in the edge) */
  lit?: boolean
}

/**
 * The blur, as the standard deviation of a CSS blur, of a `surface.frost`, which is the radius of the disc the 3D
 * glass averages the backdrop over. Fitted so that the two blur the same, by how far they take the darkest value of
 * a line of text up.
 */
const FROST_TO_BLUR = 1.5

/**
 * # GlassFallback
 * The glass in CSS, for where the 3D one isn't drawn: it blurs, saturates and tints what is behind it the way the
 * 3D glass does (`surface.frost`, `tint`), but it can't bend it, which a backdrop filter has no way to do.
 *
 * The browser keeps its backdrop in step with the page, which is why it also stands in for the 3D glass while the
 * page bounces. The rim, stroke and shadow around it are the same as the 3D glass has.
 */
export function GlassFallback(props: GlassFallbackProps) {
  const { surface, tint, plane } = props.scene
  const width = useTransform(() => props.bounds.get().layoutWidth)
  const height = useTransform(() => props.bounds.get().layoutHeight)

  // the 3D glass sees the page blurred by the provider first, which the real page isn't
  const blur = Math.hypot(surface.frost * FROST_TO_BLUR, plane.blur)

  // the light of a pressed glass goes on the backdrop too, after the blur and the saturation
  const backdrop = `blur(${blur}px) saturate(${tint.saturate})${props.lit ? ` var(${LIT_VAR},)` : ""}`

  return (
    <motion.div
      style={{
        width,
        height,
        margin: "auto",
        borderRadius: props.borderRadius,
        zIndex: -1,
        overflow: "hidden",
        backdropFilter: backdrop,
        WebkitBackdropFilter: backdrop,
        ...(props.lit
          ? { filter: `var(${LIT_VAR}, none)`, transition: "filter 0.2s ease, backdrop-filter 0.2s ease" }
          : {}),
        background:
          tint.opacity > 0 ? `color-mix(in srgb, ${props.color} ${tint.opacity * 100}%, transparent)` : undefined,
      }}
    />
  )
}
