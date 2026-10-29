import { useReducedMotion } from "motion/react"
import { useContext, useEffect, useMemo } from "react"
import { Glass3D } from "./3D"
import { GlassFallback, type GlassFallbackProps } from "./3D/fallback"
import { GlassNestContext, useGlass } from "./context"
import { GlassEdge, GlassShadow, type GlassTheme } from "./edge"
import type { GlassPreset } from "./presets"
import { type SceneConfig, SceneConfigSchema } from "./types/schemas"
import { useGlassCapability } from "./utils/capability"
import { useComputedStyle, useIncreasedContrast, useInView, useMotionBounds } from "./utils/hooks"
import { attachGlassPress, LIT_VAR } from "./utils/press"
import { parseBorderRadius, parseCornerExponent } from "./utils/style"
import { isColored, themeFromColor } from "./utils/theme"

export type GlassProps = {
  children: React.ReactNode
  /** The configuration of the glass, or a preset: what it leaves out has its default */
  options: GlassPreset | Partial<SceneConfig>
  /** Color of the glass */
  color: string
  /** Force reduce motion (disables 3D glass effect) */
  disable3D?: boolean
  /**
   * Draw the 3D glass even where the device was judged too slow for it, or the user asked for less motion. A glass
   * inside another glass is always the CSS one, see the README.
   */
  force3D?: boolean
  /** Theme of the glass, which sets the light on its edges. By default it follows the color. */
  theme?: GlassTheme
  /**
   * For glass that is a control: it lifts on hover, snaps down and lights up while pressed, and stretches toward the
   * pointer when dragged, then springs back. A drag is a gesture, so the click that would follow it is swallowed.
   * Default: false
   */
  interactive?: boolean
  /** An interactive glass above the content (a fixed header, a popover): a touch on it never scrolls what is under it */
  claimTouch?: boolean
} & React.HTMLAttributes<HTMLDivElement>

/**
 * # Glass
 *
 * A React component that renders a glass effect underneath its children.
 *
 * This component is intended to be used as a div, whose background will be
 * rendered with a glass effect. It uses Three.js and React Three Fiber to create
 * the 3D effect.
 *
 * When 3D rendering is not available (due to user preferences or performance constraints),
 * it falls back to a simpler glass effect using pure CSS.
 */
export function Glass(props: GlassProps) {
  const {
    children,
    options,
    color,
    disable3D,
    force3D,
    theme,
    interactive = false,
    claimTouch = false,
    ...rest
  } = props
  // parsed again only when the options change, not each time the parent renders: a new scene is a new draw
  const optionsKey = JSON.stringify(options)
  const scene = useMemo(() => SceneConfigSchema.parse(JSON.parse(optionsKey)), [optionsKey])
  const { snapshot, enabled, want, scrollLead } = useGlass()
  const nested = useContext(GlassNestContext)

  const [outer, corners] = useComputedStyle<HTMLDivElement, { radius: number; exponent: number; shape: string }>(
    (style) => ({
      radius: parseBorderRadius(style),
      exponent: parseCornerExponent(style),
      shape: style.getPropertyValue("corner-shape"),
    })
  )
  const borderRadius = corners?.radius || 0
  const cornerExponent = corners?.exponent ?? 2
  const reducedMotion = useReducedMotion()
  const increasedContrast = useIncreasedContrast()
  const inView = useInView(outer)
  // a region of the page can opt out with data-glass-off, which is read when the glass comes into view
  const optedOut = useMemo(() => inView && Boolean(outer.current?.closest("[data-glass-off]")), [inView, outer])
  const capable = useGlassCapability()
  // A glass inside another glass is the CSS one, even forced: the 3D glass bends the picture of the page, which has no
  // glass in it, so it would show the page through its parent. The backdrop of the CSS glass is what is behind it,
  // its parent included, which it blurs and tints as glass on glass does.
  const wants3D =
    !nested &&
    enabled &&
    !optedOut &&
    inView &&
    ((!disable3D && !reducedMotion && !increasedContrast && capable === true) || Boolean(force3D))
  const do3D = wants3D && snapshot

  // the page is captured only while some glass is going to draw it
  useEffect(() => (wants3D ? want() : undefined), [wants3D, want])

  // while it is drawn the glass follows its element on every frame, as a press or an animation moves it without a scroll
  const [ref, bounds] = useMotionBounds(Boolean(do3D))

  useEffect(() => {
    if (!interactive || !outer.current) return
    return attachGlassPress(outer.current, { claimTouch })
  }, [interactive, claimTouch, outer])

  const resolvedTheme = theme ?? themeFromColor(color)
  // a colored glass has edges of its color, a neutral one the white and black of its theme
  const edgeTint = scene.tint.opacity > 0 && isColored(color) ? color : undefined

  // The 3D glass is lit by a filter on its layer, the CSS glass on its own parts, since a filter on the layer would cut
  // its backdrop filter off from the page
  const layerLit = Boolean(do3D)
  const commonProps: GlassFallbackProps = { color, scene, bounds, borderRadius, cornerExponent, lit: !layerLit }

  return (
    <div
      ref={outer}
      glass-ignore=""
      {...rest}
      style={{
        position: "relative",
        zIndex: 1,
        ...rest.style,
      }}
    >
      <GlassShadow
        borderRadius={borderRadius}
        cornerShape={corners?.shape || undefined}
        theme={resolvedTheme}
        elevation={scene.edge.elevation}
        strength={scene.edge.shadow}
        presence={scene.edge.presence}
        nested={nested}
        tint={scene.tint.opacity > 0 ? color : undefined}
      />
      <div
        ref={ref}
        className="_polinetwork_glass-content"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",

          display: "flex",
          justifyContent: "stretch",
          alignItems: "stretch",
          borderRadius: `${borderRadius}px`,
          // the clip has to follow the same corner shape as the mesh, or it would cut it back to round
          ...(corners?.shape ? ({ cornerShape: corners.shape } as React.CSSProperties) : {}),
          overflow: "hidden",

          zIndex: -1,
          ...(layerLit ? { filter: `var(${LIT_VAR}, none)`, transition: "filter 0.2s ease" } : {}),
        }}
      >
        {do3D ? (
          <>
            <Glass3D {...commonProps} snapshot={snapshot} scrollLead={scrollLead} />
            {scene.tint.opacity > 0 && (
              <div
                className="_polinetwork_glass-tint"
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  background: `color-mix(in srgb, ${color} ${scene.tint.opacity * 100}%, transparent)`,
                }}
              />
            )}
          </>
        ) : (
          <GlassFallback {...commonProps} />
        )}
        <GlassEdge
          borderRadius={borderRadius}
          cornerShape={corners?.shape || undefined}
          theme={resolvedTheme}
          rim={scene.edge.rim}
          stroke={scene.edge.stroke}
          tint={edgeTint}
          lit={!layerLit}
        />
      </div>
      <GlassNestContext.Provider value={true}>{children}</GlassNestContext.Provider>
    </div>
  )
}
