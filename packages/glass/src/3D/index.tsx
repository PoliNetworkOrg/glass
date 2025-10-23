import { AdaptiveDpr, AdaptiveEvents, Preload, Stats, useDetectGPU } from "@react-three/drei"
import { Canvas, invalidate } from "@react-three/fiber"
import { motion, useMotionValueEvent, useTransform } from "motion/react"
import { useCallback, useMemo } from "react"
import { OrthographicCamera, type Texture } from "three"
import { useFailCondition } from "../utils/hooks"
import { GlassFallback, type GlassFallbackProps } from "./fallback"
import { SceneLights } from "./lights"
import { GlassMesh } from "./mesh"
import { BGPlane } from "./plane"

export type Glass3DProps = GlassFallbackProps & {
  texture: Texture
}

const MotCanv = motion.create(Canvas)

export function Glass3D(props: Glass3DProps) {
  // const [isSuspended, setIsSuspended] = useState(true)
  const { lighting, material, plane } = props.scene
  const gpu = useDetectGPU({
    failIfMajorPerformanceCaveat: true,
  })
  useFailCondition(() => gpu.tier < 2)

  // const texture = suspend(getTexture, [document.documentElement, 0])
  const texture = props.texture

  const width = useTransform(() => props.bounds.get().width)
  const height = useTransform(() => props.bounds.get().height)

  const camera = useMemo(() => {
    const w = width.get()
    const h = height.get()
    const camera = new OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.01, 2048)
    camera.position.set(0, 0, 512)
    return camera
  }, [width, height])

  const updateCamera = useCallback(() => {
    invalidate()
    const w = width.get()
    const h = height.get()
    camera.left = -w / 2
    camera.right = w / 2
    camera.top = h / 2
    camera.bottom = -h / 2
    camera.updateProjectionMatrix()
  }, [camera, width, height])

  useMotionValueEvent(width, "change", updateCamera)
  useMotionValueEvent(height, "change", updateCamera)

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
        boxShadow: `0 0 8px rgba(0, 0, 0, 0.1)`,
      }}
    >
      <Stats showPanel={1} />
      <AdaptiveDpr />
      <AdaptiveEvents />
      <SceneLights settings={lighting} />
      <GlassMesh color={props.color} width={width} height={height} borderRadius={16} options={material} />
      <BGPlane texture={texture} bounds={props.bounds} options={plane} />
      <Preload all />
    </MotCanv>
  )
}
