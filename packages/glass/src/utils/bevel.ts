import type { BufferGeometry } from "three"

/**
 * Reshapes the bevel of an extruded geometry so that its slope grows as `u ** curve`,
 * where `u` goes from 0 at the inner edge of the bevel to 1 at the rim.
 *
 * Three builds the bevel as a quarter ellipse (`z = depth * cos(a)`, offset `= bezel * sin(a)`),
 * whose slope is steep across the whole band. A refracting surface bends the backdrop in
 * proportion to its slope, so this gives a bezel that is flat for most of its width and bends
 * the most at the very edge, like the rim of a thick slab of glass.
 *
 * The geometry is modified in place, and its normals recomputed.
 *
 * @param geometry An {@link ExtrudeGeometry} with no extrusion depth, centered on z = 0
 * @param depth The bevelThickness the geometry was built with
 * @param curve The exponent of the slope. 1 is a linear slope, higher values flatten the face
 */
export function applyBevelProfile(geometry: BufferGeometry, depth: number, curve: number) {
  if (depth <= 0) return geometry

  const pos = geometry.getAttribute("position")
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i)
    // Recovers the position along the bezel from the height three gave the vertex
    const u = Math.sqrt(Math.max(0, 1 - (Math.abs(z) / depth) ** 2))
    pos.setZ(i, Math.sign(z) * depth * (1 - u ** (curve + 1)))
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}
