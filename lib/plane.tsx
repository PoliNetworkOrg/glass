import { invalidate, type ThreeElements } from "@react-three/fiber"
import { useAnimationFrame, useScroll } from "motion/react"
import { useCallback, useRef } from "react"
import type { RectReadOnly } from "react-use-measure"
import type { Mesh, Texture } from "three"
import { useDocumentSize } from "./utils/hooks"

export type PlaneMeshProps = {
  texture: Texture
  bounds: RectReadOnly
  mesh?: ThreeElements["mesh"]
}

export function BGPlane(props: PlaneMeshProps) {
  const plane = useRef<Mesh>(null)
  const { width: docw, height: doch } = useDocumentSize()
  const { width, height, left, top } = props.bounds

  const scroll = useScroll()
  const ttc = useCallback(() => {
    invalidate()
    return {
      x: scroll.scrollX.get() - (left + width / 2 - docw / 2),
      y: scroll.scrollY.get() + (top + height / 2 - doch / 2),
    }
  }, [props.bounds])

  useAnimationFrame(() => {
    if (plane.current) {
      const { x, y } = ttc()
      plane.current.position.set(x, y, -Math.min(width, height) * 2)
    }
  })

  return (
    <mesh ref={plane} {...props.mesh}>
      <planeGeometry args={[props.texture.width, props.texture.height]} />
      <meshBasicMaterial map={props.texture} />
    </mesh>
  )
}
