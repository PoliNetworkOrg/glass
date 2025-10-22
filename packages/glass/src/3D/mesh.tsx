import { Extrude, MeshTransmissionMaterial } from "@react-three/drei"
import { type MotionValue, useMotionValueEvent } from "motion/react"
import { useCallback, useMemo, useRef } from "react"
import type { ExtrudeGeometryOptions, Mesh, Shape } from "three"
import type { GlassConfig } from "../types/schemas"
import { createRoundedRect } from "../utils/paths"

export type GlassMeshProps = {
  width: MotionValue<number>
  height: MotionValue<number>

  borderRadius: number
  /** Color of the glass material */
  color: string
  /** Glass material options */
  options: GlassConfig
}

/**
 * # GlassMesh
 * The Three.js mesh for a glass element.
 */
export function GlassMesh(props: GlassMeshProps) {
  const { options } = props

  const geom = useRef<Mesh>(null)

  const startingWidth = useMemo(() => props.width.get(), [])
  const startingHeight = useMemo(() => props.height.get(), [])

  const updateGeometry = useCallback(() => {
    if (geom.current) {
      const w = props.width.get()
      const h = props.height.get()
      geom.current.scale.set(w / startingWidth, h / startingHeight, 1)
    }
  }, [startingWidth, startingHeight, geom.current])

  useMotionValueEvent(props.width, "change", updateGeometry)
  useMotionValueEvent(props.height, "change", updateGeometry)

  const shape = useMemo(() => createRoundedRect(startingWidth - 32, startingHeight - 32, props.borderRadius), [])

  const extrudeSettings = useMemo<ExtrudeGeometryOptions>(
    () => ({
      steps: 1,
      depth: 0,
      bevelEnabled: true,
      curveSegments: 32,
      bevelSegments: 32,
      bevelThickness: 16,
      bevelSize: 16,
      bevelOffset: 0,
    }),
    []
  )
  const args = useMemo<[Shape[], ExtrudeGeometryOptions]>(
    () => [shape.toShapes(false), extrudeSettings],
    [shape, extrudeSettings]
  )

  return (
    <Extrude ref={geom} position={[0, 0, 0]} args={args}>
      <MeshTransmissionMaterial {...options} />
    </Extrude>
  )
}
