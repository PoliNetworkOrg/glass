import { type CSSProperties, useSyncExternalStore } from "react"

export type GlassTheme = "light" | "dark"

export type GlassEdgeProps = {
  /** Corner radius of the glass, in px */
  borderRadius: number
  /** The `corner-shape` of the glass, if it has one */
  cornerShape?: string
  theme: GlassTheme
  /** Strength of the highlight on the edges, 0 is none */
  rim: number
  /** Strength of the hairline stroke around the edge, 0 is none */
  stroke: number
}

// The values are the ones of Vitrium, measured against iOS: the sides of the glass are shaded, and the
// top and bottom edges are lit.
const THEMES = {
  light: {
    /** [r, g, b], and its alpha */
    side: [0, 0, 0, 0.25],
    sideX: 1,
    sideBlur: 2,
    top: [255, 255, 255, 1],
    /** [r, g, b, alpha] stops of the stroke, from the top to the bottom edge */
    stroke: [
      [255, 255, 255, 1],
      [94, 94, 94, 0.25],
      [94, 94, 94, 0.8],
      [94, 94, 94, 0.25],
      [255, 255, 255, 1],
    ],
    strokeOpacity: 0.8,
  },
  dark: {
    side: [0, 0, 0, 1],
    sideX: 1.5,
    sideBlur: 3,
    top: [255, 255, 255, 0.2],
    stroke: [
      [223, 223, 223, 0.35],
      [41, 41, 41, 0.5],
      [0, 0, 0, 1],
      [41, 41, 41, 0.5],
      [223, 223, 223, 0.35],
    ],
    strokeOpacity: 0.8,
  },
} as const

const rgba = ([r, g, b]: readonly number[], a: number) => `rgb(${r} ${g} ${b} / ${a.toFixed(3)})`

/**
 * Whether the screen has the headroom for colors brighter than white. In light mode the lit edges are
 * already the brightest white the SDR range has, so there they barely read: on an HDR screen they are
 * pushed past it, in display-p3, which is extended range.
 */
const HDR_QUERY = "(dynamic-range: high)"
const supportsHdr = () =>
  typeof matchMedia === "function" && matchMedia(HDR_QUERY).matches && CSS.supports("color", "color(display-p3 1 1 1)")
const subscribeHdr = (onChange: () => void) => {
  if (typeof matchMedia !== "function") return () => {}
  const query = matchMedia(HDR_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/**
 * Each edge is a soft band, drawn as two unblurred layers (half of the color at the offset and 30% one
 * sigma deeper) instead of a blurred inset shadow, which costs a full blur of the element every time
 * it is drawn.
 */
function rimShadow(theme: GlassTheme, strength: number, hdr: boolean) {
  const { side, sideX, sideBlur, top } = THEMES[theme]
  const shade = (k: number) => rgba(side, side[3] * k * strength)
  const light = (k: number) =>
    hdr && theme === "light"
      ? `color(display-p3 2 2 2 / ${(top[3] * k * strength).toFixed(3)})`
      : rgba(top, top[3] * k * strength)
  return [
    `inset ${-sideX}px 0 0 0 ${shade(0.5)}`,
    `inset ${-sideX}px 0 0 ${sideBlur * 0.5}px ${shade(0.3)}`,
    `inset ${sideX}px 0 0 0 ${shade(0.5)}`,
    `inset ${sideX}px 0 0 ${sideBlur * 0.5}px ${shade(0.3)}`,
    `inset 0 -1px 0 0 ${light(0.5)}`,
    `inset 0 -1px 0 1px ${light(0.3)}`,
    `inset 0 1px 0 0 ${light(0.5)}`,
    `inset 0 1px 0 1px ${light(0.3)}`,
  ].join(", ")
}

/**
 * # GlassEdge
 * The light on the edges of the glass: a highlight on its rim, and a hairline stroke around it.
 *
 * It is drawn over the glass, inside it, so it needs a parent that is positioned and that clips
 * to the shape of the glass.
 */
export function GlassEdge(props: GlassEdgeProps) {
  const { borderRadius, cornerShape, theme, rim, stroke } = props
  const t = THEMES[theme]
  const hdr = useSyncExternalStore(subscribeHdr, supportsHdr, () => false)

  const shape: CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius,
    pointerEvents: "none",
    ...(cornerShape ? ({ cornerShape } as CSSProperties) : {}),
  }

  return (
    <>
      {rim > 0 && (
        <div className="_polinetwork_glass-rim" style={{ ...shape, boxShadow: rimShadow(theme, rim, hdr) }} />
      )}
      {stroke > 0 && (
        <div
          className="_polinetwork_glass-stroke"
          style={{
            ...shape,
            padding: 0.5,
            background: `linear-gradient(to bottom, ${t.stroke.map(([r, g, b, a], i) => `${rgba([r, g, b], a)} ${i * 25}%`).join(", ")})`,
            opacity: t.strokeOpacity * stroke,
            // a ring: the padding box is cut out of the whole box
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />
      )}
    </>
  )
}

export type GlassElevation = "low" | "default" | "high" | "extra-high"

export type GlassShadowProps = {
  borderRadius: number
  cornerShape?: string
  theme: GlassTheme
  /** How high the glass floats, which shapes the shadow it casts */
  elevation: GlassElevation
  /** Strength of the shadow, 0 is none */
  strength: number
  /** Strength of a faint, tight shadow kept at every elevation, for glass that would read flat */
  presence: number
  /** The glass is inside another glass, where the shadow lands on a lighter surface and is dimmed */
  nested: boolean
  /** The color of a tinted glass, which casts a glow in it instead of a black shadow */
  tint?: string
}

/**
 * The levels: the size of the ring as a multiple of the high ring, its darkness, and whether the glass
 * casts the faint shadow right below it. Measured off iOS / iPadOS on a white page.
 */
const LEVELS = {
  low: { size: 1, ring: 0, drop: 0 },
  default: { size: 1, ring: 0, drop: 1 },
  high: { size: 1, ring: 1, drop: 0 },
  "extra-high": { size: 3, ring: 0.95, drop: 0 },
} as const

const RING = {
  light: { color: 0.095, fill: 0, presence: 0.12 },
  dark: { color: 0.25, fill: 0.04, presence: 0.4 },
} as const

/** What a mask that grows past the box needs, which Safari accepts but still clips to the box */
const canMaskPastBox = () =>
  typeof CSS !== "undefined" && CSS.supports("mask-clip", "no-clip") && !CSS.supports("font", "-apple-system-body")

/**
 * # GlassShadow
 * The shadow the glass casts. Glass doesn't cast a solid shadow: light goes through the middle and
 * only the edges bend it away, so what lands on the page is a soft ring in the shape of the glass,
 * dropped below it. Its top half shows through the glass and its bottom half peeks out underneath.
 * A higher glass casts it farther away and softer.
 *
 * It goes behind the glass and reaches outside of it, so nothing around the glass can clip it.
 */
export function GlassShadow(props: GlassShadowProps) {
  const { borderRadius, cornerShape, theme, elevation, strength, presence, nested, tint } = props
  const level = LEVELS[elevation]
  const ring = RING[theme]

  // black, or the color of a tinted glass moved towards black
  const color = (alpha: number, tintAlpha: number) =>
    tint
      ? `color-mix(in srgb, color-mix(in oklch, ${tint} 85%, black) ${tintAlpha * 100}%, transparent)`
      : `rgb(0 0 0 / ${alpha.toFixed(3)})`

  const e = level.size
  const offset = 6 * e
  const blur = (7 * (e + e * e)) / 2
  const spread = 1.5 * e
  const drop = 9 * e
  const soften = 3 * Math.max(0, e - 1) * 1.05
  const reach = (blur + spread + soften) * 2
  const k = level.ring * strength * (nested ? 0.6 : 1)

  const shape: CSSProperties = {
    position: "absolute",
    borderRadius,
    pointerEvents: "none",
    zIndex: -1,
    ...(cornerShape ? ({ cornerShape } as CSSProperties) : {}),
  }

  // what is cast right below the glass: the faint shadow of the default level, and the presence
  const below = [
    level.drop && strength > 0 && `0 5px 14px -4px ${color(0.1 * strength, 0.2 * strength)}`,
    presence > 0 && `0 3px 10px -3px ${color(ring.presence * presence, 0.55 * presence)}`,
  ].filter(Boolean)

  const maskPastBox = canMaskPastBox()
  const ringColor = color(ring.color * k, 0.3 * k)

  return (
    <>
      {below.length > 0 && (
        <div className="_polinetwork_glass-drop" style={{ ...shape, inset: 0, boxShadow: below.join(", ") }} />
      )}
      {k > 0 && (
        <div
          className="_polinetwork_glass-ring"
          style={{
            ...shape,
            inset: `${drop}px 0 ${-offset}px`,
            background: ring.fill ? `rgb(0 0 0 / ${(ring.fill * k).toFixed(3)})` : undefined,
            boxShadow: `0 0 ${blur}px ${spread}px ${ringColor}, inset 0 0 ${blur}px ${spread}px ${ringColor}`,
            filter: soften ? `blur(${soften}px)` : undefined,
            // a shadow can't take a gradient, so the ring is faded with a mask: weaker at the top, where it shows
            // through the glass, up to full strength towards the bottom, below it
            ...(maskPastBox
              ? {
                  WebkitMask: `linear-gradient(to bottom, rgb(0 0 0 / 0.45), #000 80%) center / calc(100% + ${reach}px) calc(100% + ${reach}px) no-repeat`,
                  mask: `linear-gradient(to bottom, rgb(0 0 0 / 0.45), #000 80%) center / calc(100% + ${reach}px) calc(100% + ${reach}px) no-repeat`,
                  maskClip: "no-clip",
                }
              : {}),
          }}
        />
      )}
    </>
  )
}
