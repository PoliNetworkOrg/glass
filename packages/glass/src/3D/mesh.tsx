import { MeshTransmissionMaterial } from "@react-three/drei"
import { invalidate } from "@react-three/fiber"
import { type MotionValue, useMotionValueEvent } from "motion/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { RectReadOnly } from "react-use-measure"
import { ExtrudeGeometry, type ExtrudeGeometryOptions } from "three"
import type { GlassConfig, ShapeConfig } from "../types/schemas"
import { applyBevelProfile } from "../utils/bevel"
import { createRoundedRect } from "../utils/paths"
import { reshapeGeometry } from "../utils/reshape"

/** The bevel can't be wider than half of the shortest side, or the inner shape would invert */
const clampBevel = (bezel: number, w: number, h: number) => Math.min(bezel, Math.max(1, Math.min(w, h) / 2 - 1))

export type GlassMeshProps = {
  /** The bounds of the element, updated outside of react */
  bounds: MotionValue<RectReadOnly>

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

  // The size the geometry was built for. Resizing moves its vertices (see reshapeGeometry) instead
  // of building it again, and only if that can't hold, because the element got too small or the
  // bevel is clamped differently at the new size, is it rebuilt at the current size.
  const [built, setBuilt] = useState(() => ({ w: props.bounds.get().width, h: props.bounds.get().height }))

  const { geometry, base, region } = useMemo(() => {
    const bevelSize = clampBevel(props.shape.bezel, built.w, built.h)
    // the bevel grows the shape outwards by bevelSize, so the outer corner ends up at borderRadius
    const shape = createRoundedRect(
      Math.max(1, built.w - bevelSize * 2),
      Math.max(1, built.h - bevelSize * 2),
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
    const geometry = applyBevelProfile(
      new ExtrudeGeometry(shape.toShapes(false), extrudeSettings),
      props.shape.depth,
      props.shape.curve
    )
    return {
      geometry,
      base: Float32Array.from(geometry.getAttribute("position").array),
      region: Math.max(Math.min(props.borderRadius, built.w / 2, built.h / 2), bevelSize),
    }
  }, [
    props.borderRadius,
    props.cornerExponent,
    props.shape.bezel,
    props.shape.depth,
    props.shape.curve,
    built.w,
    built.h,
  ])

  useEffect(() => () => geometry.dispose(), [geometry])

  const resize = useCallback(() => {
    const { width, height } = props.bounds.get()
    const to = { w: width, h: height }
    const bevelChanged =
      Math.abs(clampBevel(props.shape.bezel, to.w, to.h) - clampBevel(props.shape.bezel, built.w, built.h)) > 0.5
    if (bevelChanged || !reshapeGeometry(geometry, base, built, to, region)) {
      setBuilt((b) => (Math.abs(b.w - to.w) < 0.5 && Math.abs(b.h - to.h) < 0.5 ? b : to))
    } else {
      invalidate()
    }
  }, [built, geometry, base, region, props.shape.bezel, props.bounds])

  useMotionValueEvent(props.bounds, "change", resize)

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <MeshTransmissionMaterial {...options} />
    </mesh>
  )
}
