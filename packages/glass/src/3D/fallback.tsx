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
 * The `lift` of the 3D glass (the colors to the power of it) as the CSS filters that come closest, since a
 * backdrop filter has no gamma: the line `c + a·x` that fits `x^lift` best, written as a `contrast()` and a
 * `brightness()`, which can only scale and offset. The fit is by relative error, so that the shadows, which are what
 * the lift is for and where a page that gets a dark glass mostly is, come out right and not washed to a gray.
 */
export function liftFilter(lift: number) {
  if (lift >= 1) return ""
  const samples = 64
  let s = 0
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < samples; i++) {
    const x = (i + 0.5) / samples
    const y = x ** lift
    const w = 1 / (y + 0.02) ** 2
    s += w
    sx += w * x
    sy += w * y
    sxx += w * x * x
    sxy += w * x * y
  }
  const a = (s * sxy - sx * sy) / (s * sxx - sx * sx)
  const c = (sy - a * sx) / s
  // contrast(C) then brightness(K) is K·C·x + K·(1 - C)/2
  const k = a + 2 * c
  return ` contrast(${a / k}) brightness(${k})`
}

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

  // the light of a pressed glass goes on the backdrop too, after the blur, the saturation and the lift
  const backdrop = `blur(${blur}px) saturate(${tint.saturate})${liftFilter(tint.lift)}${props.lit ? ` var(${LIT_VAR},)` : ""}`

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
