import { MeshTransmissionMaterial } from "@react-three/drei"
import { type MotionValue, useMotionValueEvent } from "motion/react"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { ExtrudeGeometry, type ExtrudeGeometryOptions, type Mesh } from "three"
import type { GlassConfig, ShapeConfig } from "../types/schemas"
import { applyBevelProfile } from "../utils/bevel"
import { createRoundedRect } from "../utils/paths"

export type GlassMeshProps = {
  width: MotionValue<number>
  height: MotionValue<number>

  borderRadius: number
  /** Superellipse exponent of the corners, 2 is round and 4 a squircle */
  cornerExponent: number
  /** Bevel geometry */
  shape: ShapeConfig
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

  const geometry = useMemo(() => {
    // the bevel can't be wider than half of the shortest side, or the inner shape would invert
    const maxBevel = Math.max(1, Math.min(startingWidth, startingHeight) / 2 - 1)
    const bevelSize = Math.min(props.shape.bezel, maxBevel)
    // the bevel grows the shape outwards by bevelSize, so the outer corner ends up at borderRadius
    const shape = createRoundedRect(
      Math.max(1, startingWidth - bevelSize * 2),
      Math.max(1, startingHeight - bevelSize * 2),
      Math.max(0, props.borderRadius - bevelSize),
      props.cornerExponent
    )
    const extrudeSettings: ExtrudeGeometryOptions = {
      steps: 1,
      depth: 0,
      bevelEnabled: true,
      curveSegments: 32,
      bevelSegments: 32,
      bevelThickness: props.shape.depth,
      bevelSize,
      bevelOffset: 0,
    }
    const geometry = new ExtrudeGeometry(shape.toShapes(false), extrudeSettings)
    return applyBevelProfile(geometry, props.shape.depth, props.shape.curve)
  }, [
    props.borderRadius,
    props.cornerExponent,
    props.shape.bezel,
    props.shape.depth,
    props.shape.curve,
    startingWidth,
    startingHeight,
  ])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh ref={geom} geometry={geometry}>
      <MeshTransmissionMaterial {...options} />
    </mesh>
  )
}
