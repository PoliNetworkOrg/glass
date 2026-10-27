import { AdaptiveDpr, AdaptiveEvents, Preload } from "@react-three/drei"
import { advance, Canvas, useThree } from "@react-three/fiber"
import { motion, useMotionValueEvent } from "motion/react"
import { useMemo, useRef } from "react"
import { OrthographicCamera, type Texture } from "three"
// import { useFailCondition } from "../utils/hooks"
import { GlassFallback, type GlassFallbackProps } from "./fallback"
import { SceneLights } from "./lights"
import { GlassMesh } from "./mesh"
import { BGPlane } from "./plane"

export type Glass3DProps = GlassFallbackProps & {
  texture: Texture
}

const MotCanv = motion.create(Canvas)

/**
 * Keeps the size of the canvas in step with the element as it changes.
 *
 * The canvas follows the element on its own, but only after it has measured it, a few
 * frames later, and until then it shows a cropped view of a mesh that is already resized.
 * This sets the size in the same event that moves the mesh and renders that frame right away,
 * since resizing a canvas clears it.
 *
 * It has to come after everything else that listens to the bounds, so they are up to date.
 */
function SyncSize({ bounds }: { bounds: Glass3DProps["bounds"] }) {
  const get = useThree((state) => state.get)
  const last = useRef({ width: 0, height: 0 })

  useMotionValueEvent(bounds, "change", () => {
    const { width, height } = bounds.get()
    if (width <= 0 || height <= 0) return
    if (width === last.current.width && height === last.current.height) return
    last.current = { width, height }
    const state = get()
    state.setSize(width, height, state.size.top, state.size.left)
    advance(performance.now(), false, get())
    // everything that changed has been drawn, so the frames the listeners asked for are redundant
    get().internal.frames = 0
  })

  return null
}

export function Glass3D(props: Glass3DProps) {
  // const [isSuspended, setIsSuspended] = useState(true)
  const { lighting, material, plane, shape, tint } = props.scene
  // const gpu = useDetectGPU({
  //   failIfMajorPerformanceCaveat: true,
  // })
  // useFailCondition(() => gpu.tier < 2)

  // const texture = suspend(getTexture, [document.documentElement, 0])
  const texture = props.texture

  // R3F keeps the frustum in step with the size of the canvas after this (see SyncSize)
  const camera = useMemo(() => {
    const { width: w, height: h } = props.bounds.get()
    const camera = new OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.01, 2048)
    camera.position.set(0, 0, 512)
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
      style={{
        width: "100%",
        height: "100%",
        margin: "auto",
        borderRadius: 5,
        zIndex: -1,
        overflow: "hidden",
        filter: tint.saturate !== 1 ? `saturate(${tint.saturate})` : undefined,
        boxShadow: `0 0 8px rgba(0, 0, 0, 0.1)`,
      }}
    >
      <AdaptiveDpr />
      <AdaptiveEvents />
      <SceneLights settings={lighting} />
      <GlassMesh
        color={props.color}
        bounds={props.bounds}
        borderRadius={props.borderRadius}
        cornerExponent={props.cornerExponent ?? 2}
        shape={shape}
        options={material}
      />
      <BGPlane texture={texture} bounds={props.bounds} options={plane} />
      <SyncSize bounds={props.bounds} />
      <Preload all />
    </MotCanv>
  )
}
