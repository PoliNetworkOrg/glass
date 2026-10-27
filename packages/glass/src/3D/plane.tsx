import { invalidate } from "@react-three/fiber"
import { type MotionValue, useAnimationFrame, useMotionValueEvent } from "motion/react"
import { useCallback, useRef } from "react"
import type { Mesh, Texture } from "three"
import type { PlaneConfig } from "../types/schemas"
import type { GlassBounds } from "../utils/hooks"

export type PlaneMeshProps = {
  /** The texture containing a screenshot of the document */
  texture: Texture
  /** The motion value containing the bounds of the element, updated outside of react */
  bounds: MotionValue<GlassBounds>

  options: PlaneConfig
}

/**
 * # BGPlane
 * A Three.js plane mesh that displays a texture of the document background.
 *
 * This component updates its position based on the scroll position and the bounds
 * of the target element, ensuring that it stays aligned with the viewport.
 *
 * @param props The properties for the BGPlane component
 */
export function BGPlane(props: PlaneMeshProps) {
  const plane = useRef<Mesh>(null)
  const { texture } = props
  // const texture = useTexture(props.texture)

  const getCoords = useCallback(() => {
    const docw = document.documentElement.scrollWidth
    const doch = document.documentElement.scrollHeight
    const { width, height, left, top } = props.bounds.get()

    // calculating the offsets at each frame is actually more performant
    // having them handled through state changes saves unnecessary calculations
    // but the state changes themselves are more expensive than recalculating here
    const xoff = left + width / 2 - docw / 2
    const yoff = top + height / 2 - doch / 2
    // read from the window and not from scroll events: where the page is pulled past its end (an overscroll) the
    // position can change without one
    return [window.scrollX - xoff, window.scrollY + yoff] as [number, number]
  }, [props.bounds])

  const updatePosition = useCallback(() => {
    if (plane.current) {
      const [x, y] = getCoords()
      if (plane.current.position.x !== x || plane.current.position.y !== y) {
        invalidate()
        plane.current.position.x = x
        plane.current.position.y = y
      }
    }
  }, [getCoords])

  // update in lockstep with motion's frames (for the scroll)
  useAnimationFrame(updatePosition)
  // and right away when the element changes, the position depends on its size too
  useMotionValueEvent(props.bounds, "change", updatePosition)

  return (
    <mesh ref={plane} name="glass-bg" position={[...getCoords(), -1000]}>
      <planeGeometry args={[texture.width, texture.height]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}
