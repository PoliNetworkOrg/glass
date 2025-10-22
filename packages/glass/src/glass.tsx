import { useReducedMotion } from "motion/react"
import { Suspense } from "react"
import { Glass3D } from "./3D"
import { GlassFallback, type GlassFallbackProps } from "./3D/fallback"
import { useGlass } from "./context"
import { type SceneConfig, SceneConfigSchema } from "./types/schemas"
import { useComputedStyle, useIncreasedContrast, useMotionBounds } from "./utils/hooks"

export type GlassProps = {
  children: React.ReactNode
  /** Glass material options */
  options: Partial<SceneConfig>
  /** Color of the glass material */
  color: string
  /** Force reduce motion (disables 3D glass effect) */
  disable3D?: boolean
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
  const { children, options, color, disable3D, ...rest } = props
  const scene = SceneConfigSchema.parse(options)
  const { texture } = useGlass()

  const [outer, br] = useComputedStyle<HTMLDivElement, number>((style) => {
    const match = style.borderRadius.match(/(\d+)px/)
    return match ? parseInt(match[1], 10) : 0
  })
  const borderRadius = br || 0
  const [ref, bounds] = useMotionBounds()
  const reducedMotion = useReducedMotion()
  const increasedContrast = useIncreasedContrast()
  const do3D = texture && !disable3D && !reducedMotion && !increasedContrast

  const commonProps: GlassFallbackProps = { color, scene, bounds, borderRadius }

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
          overflow: "hidden",

          zIndex: -1,
        }}
      >
        {do3D ? (
          <Suspense fallback={<GlassFallback {...commonProps} />}>
            <Glass3D {...commonProps} texture={texture} />
          </Suspense>
        ) : (
          <GlassFallback {...commonProps} />
        )}
      </div>
      {children}
    </div>
  )
}
