import { useReducedMotion } from "motion/react"
import { Suspense, useContext, useMemo } from "react"
import { Glass3D } from "./3D"
import { GlassFallback, type GlassFallbackProps } from "./3D/fallback"
import { GlassNestContext, useGlass } from "./context"
import { GlassEdge, GlassShadow, type GlassTheme } from "./edge"
import { type SceneConfig, SceneConfigSchema } from "./types/schemas"
import { useGlassCapability } from "./utils/capability"
import { useComputedStyle, useIncreasedContrast, useInView, useMotionBounds } from "./utils/hooks"
import { parseBorderRadius, parseCornerExponent } from "./utils/style"
import { themeFromColor } from "./utils/theme"

export type GlassProps = {
  children: React.ReactNode
  /** Glass material options */
  options: Partial<SceneConfig>
  /** Color of the glass material */
  color: string
  /** Force reduce motion (disables 3D glass effect) */
  disable3D?: boolean
  /** Draw the 3D glass even where the device was judged too slow for it, or the user asked for less motion */
  force3D?: boolean
  /** Theme of the glass, which sets the light on its edges. By default it follows the color. */
  theme?: GlassTheme
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
  const { children, options, color, disable3D, force3D, theme, ...rest } = props
  const scene = SceneConfigSchema.parse(options)
  const { texture, enabled } = useGlass()
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
  const [ref, bounds] = useMotionBounds()
  const reducedMotion = useReducedMotion()
  const increasedContrast = useIncreasedContrast()
  const inView = useInView(outer)
  // a region of the page can opt out with data-glass-off, which is read when the glass comes into view
  const optedOut = useMemo(() => inView && Boolean(outer.current?.closest("[data-glass-off]")), [inView, outer])
  const capable = useGlassCapability()
  const do3D =
    enabled &&
    !optedOut &&
    texture &&
    inView &&
    ((!disable3D && !reducedMotion && !increasedContrast && capable === true) || force3D)

  const resolvedTheme = theme ?? themeFromColor(color)

  const commonProps: GlassFallbackProps = { color, scene, bounds, borderRadius, cornerExponent }

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
        }}
      >
        {do3D ? (
          <>
            <Suspense fallback={<GlassFallback {...commonProps} />}>
              <Glass3D {...commonProps} texture={texture} />
            </Suspense>
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
        />
      </div>
      <GlassNestContext.Provider value={true}>{children}</GlassNestContext.Provider>
    </div>
  )
}
