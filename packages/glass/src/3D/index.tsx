import { advance, Canvas, useThree } from "@react-three/fiber"
import { motion, useMotionValueEvent } from "motion/react"
import { useMemo, useRef } from "react"
import { OrthographicCamera, type Texture } from "three"
import { GlassDisplacement } from "./displacement"
import { GlassFallback, type GlassFallbackProps } from "./fallback"
import { BGPlane } from "./plane"

export type Glass3DProps = GlassFallbackProps & {
  texture: Texture
  /** Fade the canvas out, for while the CSS glass stands in for it */
  hidden?: boolean
}

const MotCanv = motion.create(Canvas)

/**
 * Keeps the canvas and the view in step with the element as it changes.
 *
 * The canvas is the size of the box of the element and is drawn on screen by the element's transform (a press scales
 * it), so what it shows is lined up with the page by a view as big as the element is drawn, which makes a unit of
 * the scene a pixel of the screen. R3F would size the view like the canvas, so it is told not to (`manual`) and this
 * sets it.
 *
 * It sets the size in the same event that moves the glass and renders that frame right away, since resizing a
 * canvas clears it, and it has to come after everything else that listens to the bounds, so they are up to date.
 */
function SyncSize({ bounds }: { bounds: Glass3DProps["bounds"] }) {
  const get = useThree((state) => state.get)
  const last = useRef({ width: 0, height: 0, layoutWidth: 0, layoutHeight: 0 })

  useMotionValueEvent(bounds, "change", () => {
    const { width, height, layoutWidth, layoutHeight } = bounds.get()
    if (width <= 0 || height <= 0 || layoutWidth <= 0 || layoutHeight <= 0) return
    const l = last.current
    if (width === l.width && height === l.height && layoutWidth === l.layoutWidth && layoutHeight === l.layoutHeight)
      return
    last.current = { width, height, layoutWidth, layoutHeight }
    const state = get()
    const camera = state.camera as OrthographicCamera
    camera.left = -width / 2
    camera.right = width / 2
    camera.top = height / 2
    camera.bottom = -height / 2
    camera.updateProjectionMatrix()
    state.setSize(layoutWidth, layoutHeight, state.size.top, state.size.left)
    advance(performance.now(), false, get())
    // everything that changed has been drawn, so the frames the listeners asked for are redundant
    get().internal.frames = 0
  })

  return null
}

export function Glass3D(props: Glass3DProps) {
  // const [isSuspended, setIsSuspended] = useState(true)
  const { plane, shape, surface, tint } = props.scene
  // const texture = suspend(getTexture, [document.documentElement, 0])
  const texture = props.texture

  // R3F keeps the frustum in step with the size of the canvas after this (see SyncSize)
  const camera = useMemo(() => {
    const { width: w, height: h } = props.bounds.get()
    const camera = new OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.01, 2048)
    camera.position.set(0, 0, 512)
    // the view is set by SyncSize and not by the size of the canvas
    camera.manual = true
    return camera
  }, [props.bounds])

  return (
    <MotCanv
      orthographic
      flat
      fallback={<GlassFallback {...props} />}
      dpr={1}
      camera={camera}
      frameloop="demand"
      resize={{ offsetSize: true }}
      style={{
        width: "100%",
        height: "100%",
        margin: "auto",
        borderRadius: 5,
        zIndex: -1,
        overflow: "hidden",
        opacity: props.hidden ? 0 : 1,
        transition: "opacity 0.15s ease",
        filter: tint.saturate !== 1 ? `saturate(${tint.saturate})` : undefined,
        boxShadow: `0 0 8px rgba(0, 0, 0, 0.1)`,
      }}
    >
      <GlassDisplacement
        bounds={props.bounds}
        borderRadius={props.borderRadius}
        cornerExponent={props.cornerExponent ?? 2}
        shape={shape}
        frost={surface.frost}
        texture={texture}
      />
      <BGPlane texture={texture} bounds={props.bounds} options={plane} />
      <SyncSize bounds={props.bounds} />
    </MotCanv>
  )
}
