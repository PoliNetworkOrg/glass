import { Plane } from "@react-three/drei"
import { type MotionValue, useAnimationFrame, useScroll } from "motion/react"
import { useRef } from "react"
import type { RectReadOnly } from "react-use-measure"
import type { Mesh, Texture } from "three"
import type { PlaneConfig } from "../types/schemas"

export type PlaneMeshProps = {
  /** The texture containing a screenshot of the document */
  texture: Texture
  /** The motion value containing the bounds of the element, updated outside of react */
  bounds: MotionValue<RectReadOnly>

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
  // Get scroll positions from motion's useScroll
  const { scrollX, scrollY } = useScroll()

  useAnimationFrame(() => {
    // update in lockstep with motion's frames
    if (plane.current) {
      // update the plane position based on scroll and bounds
      const docw = document.documentElement.scrollWidth
      const doch = document.documentElement.scrollHeight
      const { width, height, left, top } = props.bounds.get()

      // calculating the offsets at each frame is actually more performant
      // having them handled through state changes saves unnecessary calculations
      // but the state changes themselves are more expensive than recalculating here
      const xoff = left + width / 2 - docw / 2
      const yoff = top + height / 2 - doch / 2

      plane.current.position.x = scrollX.get() - xoff
      plane.current.position.y = scrollY.get() + yoff
    }
  })

  return (
    <Plane ref={plane} position={[0, 0, -1000]} args={[props.texture.width, props.texture.height]}>
      <meshBasicMaterial map={props.texture} />
    </Plane>
  )
}
