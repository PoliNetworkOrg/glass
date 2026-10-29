import { Canvas } from "@react-three/fiber"
import { motion } from "motion/react"
import { useMemo } from "react"
import { OrthographicCamera, type Texture } from "three"
import { GlassDisplacement } from "./displacement"
import { GlassFallback, type GlassFallbackProps } from "./fallback"

export type Glass3DProps = GlassFallbackProps & {
  texture: Texture
  /** Fade the canvas out, for while the CSS glass stands in for it */
  hidden?: boolean
}

const MotCanv = motion.create(Canvas)

export function Glass3D(props: Glass3DProps) {
  // const [isSuspended, setIsSuspended] = useState(true)
  const { shape, surface, tint } = props.scene
  // const texture = suspend(getTexture, [document.documentElement, 0])
  const texture = props.texture

  // the view and the size of the canvas are kept in step with the element by the displacement, which draws it
  const camera = useMemo(() => {
    const { width: w, height: h } = props.bounds.get()
    const camera = new OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.01, 2048)
    camera.position.set(0, 0, 512)
    // the view is set as big as the element is drawn, and not by the size of the canvas
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
      // drawn by the frame loop of the glass, in the same frame it reads the page, and not by R3F a frame later
      frameloop="never"
      resize={{ offsetSize: true }}
      style={{
        width: "100%",
        height: "100%",
        margin: "auto",
        borderRadius: 5,
        zIndex: -1,
        overflow: "hidden",
        // nothing in it is interactive, and R3F would raycast every pointer move over it
        pointerEvents: "none",
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
    </MotCanv>
  )
}
