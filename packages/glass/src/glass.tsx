import { useReducedMotion } from "motion/react"
import { Suspense, useContext, useEffect, useMemo } from "react"
import { Glass3D } from "./3D"
import { GlassFallback, type GlassFallbackProps } from "./3D/fallback"
import { GlassNestContext, useGlass } from "./context"
import { GlassEdge, GlassShadow, type GlassTheme } from "./edge"
import { type SceneConfig, SceneConfigSchema } from "./types/schemas"
import { useGlassCapability } from "./utils/capability"
import { useFade, useOverscroll } from "./utils/overscroll"
import { useComputedStyle, useIncreasedContrast, useInView, useMotionBounds } from "./utils/hooks"
import { attachGlassPress, LIT_VAR } from "./utils/press"
import { parseBorderRadius, parseCornerExponent } from "./utils/style"
import { isColored, themeFromColor } from "./utils/theme"

export type GlassProps = {
  children: React.ReactNode
  /** The configuration of the glass, or a preset */
  options: Partial<SceneConfig>
  /** Color of the glass */
  color: string
  /** Force reduce motion (disables 3D glass effect) */
  disable3D?: boolean
  /** Draw the 3D glass even where the device was judged too slow for it, or the user asked for less motion */
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
  const { texture, enabled, want } = useGlass()
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
  const wants3D =
    enabled &&
    !optedOut &&
    inView &&
    ((!disable3D && !reducedMotion && !increasedContrast && capable === true) || Boolean(force3D))
  const do3D = wants3D && texture

  // the page is captured only while some glass is going to draw it
  useEffect(() => (wants3D ? want() : undefined), [wants3D, want])

  // where the page bounces past its end the canvas can't follow it, and the CSS glass can: see utils/overscroll.ts
  const bouncing = useOverscroll(Boolean(do3D))
  const fade = useFade(bouncing, 150)

  // while it is drawn the glass follows its element on every frame, as a press or an animation moves it without a scroll
  const [ref, bounds] = useMotionBounds(Boolean(do3D))

  useEffect(() => {
    if (!interactive || !outer.current) return
    return attachGlassPress(outer.current, { claimTouch })
  }, [interactive, claimTouch, outer])

  const resolvedTheme = theme ?? themeFromColor(color)
  // a colored glass has edges of its color, a neutral one the white and black of its theme
  const edgeTint = scene.tint.opacity > 0 && isColored(color) ? color : undefined

  // The 3D glass is lit by a filter on its layer, the CSS glass (which is also what stands in for it while the page
  // bounces) on its own parts, since a filter on the layer would cut its backdrop filter off from the page
  const layerLit = Boolean(do3D) && !fade.mounted
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
            <Suspense fallback={<GlassFallback {...commonProps} />}>
              <Glass3D {...commonProps} texture={texture} hidden={fade.visible} />
            </Suspense>
            {scene.tint.opacity > 0 && (
              <div
                className="_polinetwork_glass-tint"
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  background: `color-mix(in srgb, ${color} ${scene.tint.opacity * 100}%, transparent)`,
                  opacity: fade.visible ? 0 : 1,
                  transition: "opacity 0.15s ease",
                }}
              />
            )}
            {fade.mounted && (
              <div
                className="_polinetwork_glass-bounce"
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  pointerEvents: "none",
                  opacity: fade.visible ? 1 : 0,
                  transition: "opacity 0.15s ease",
                }}
              >
                <GlassFallback {...commonProps} />
              </div>
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
