import { useReducedMotion } from "motion/react"
import { Suspense } from "react"
import { Glass3D } from "./3D"
import { GlassFallback, type GlassFallbackProps } from "./3D/fallback"
import { useGlass } from "./context"
import { type SceneConfig, SceneConfigSchema } from "./types/schemas"
import { useComputedStyle, useIncreasedContrast, useMotionBounds } from "./utils/hooks"
import { parseBorderRadius, parseCornerExponent } from "./utils/style"

export type GlassProps = {
  children: React.ReactNode
  /** Glass material options */
  options: Partial<SceneConfig>
  /** Color of the glass material */
  color: string
  /** Force reduce motion (disables 3D glass effect) */
  disable3D?: boolean
  force3D?: boolean
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
  const { children, options, color, disable3D, force3D, ...rest } = props
  const scene = SceneConfigSchema.parse(options)
  const { texture } = useGlass()

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
  const do3D = texture && ((!disable3D && !reducedMotion && !increasedContrast) || force3D)

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
      </div>
      {children}
    </div>
  )
}
