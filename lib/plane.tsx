import type { ThreeElements } from "@react-three/fiber"
import { type MotionValue, useAnimationFrame, useScroll } from "motion/react"
import { useRef } from "react"
import type { RectReadOnly } from "react-use-measure"
import type { Mesh, Texture } from "three"

export type PlaneMeshProps = {
  texture: Texture
  bounds: MotionValue<RectReadOnly>
  mesh?: ThreeElements["mesh"]
}

export function BGPlane(props: PlaneMeshProps) {
  const plane = useRef<Mesh>(null)
  const { scrollX, scrollY } = useScroll()

  useAnimationFrame(() => {
    if (plane.current) {
      const docw = document.documentElement.scrollWidth
      const doch = document.documentElement.scrollHeight
      const { width, height, left, top } = props.bounds.get()

      const xoff = left + width / 2 - docw / 2
      const yoff = top + height / 2 - doch / 2

      plane.current.position.x = scrollX.get() - xoff
      plane.current.position.y = scrollY.get() + yoff
      // plane.current.position.z = -Math.min(width, height) * 2
    }
  })

  return (
    <mesh ref={plane} {...props.mesh}>
      <planeGeometry args={[props.texture.width, props.texture.height]} />
      <meshBasicMaterial map={props.texture} />
    </mesh>
  )
}
