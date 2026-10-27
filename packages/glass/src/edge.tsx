import type { CSSProperties } from "react"

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
 * Each edge is a soft band, drawn as two unblurred layers (half of the color at the offset and 30% one
 * sigma deeper) instead of a blurred inset shadow, which costs a full blur of the element every time
 * it is drawn.
 */
function rimShadow(theme: GlassTheme, strength: number) {
  const { side, sideX, sideBlur, top } = THEMES[theme]
  const shade = (k: number) => rgba(side, side[3] * k * strength)
  const light = (k: number) => rgba(top, top[3] * k * strength)
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

  const shape: CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius,
    pointerEvents: "none",
    ...(cornerShape ? ({ cornerShape } as CSSProperties) : {}),
  }

  return (
    <>
      {rim > 0 && <div className="_polinetwork_glass-rim" style={{ ...shape, boxShadow: rimShadow(theme, rim) }} />}
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
