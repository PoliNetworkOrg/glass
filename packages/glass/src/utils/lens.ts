import type { BufferGeometry } from "three"

/**
 * Bends the face of an extruded glass like a lens, by tilting its normals.
 *
 * A refracting surface bends what is behind it according to its normal, so the face can bend it
 * without changing its shape. The vertices of the face are on its outline, and a triangle blends
 * the normals of its corners, so tilting those outwards (or inwards) leaves the middle flat and bends
 * the more the closer to the rim, which is how a lens does it.
 *
 * Positive values tilt the normals outwards, which magnifies what is behind the glass, and negative values
 * shrink it. It breaks up past about 0.3, where the faces blend normals unevenly across a large face. It has to be applied to the geometry as it is built (the bevel and
 * the normals done), and it survives resizing, which moves the corners rigidly.
 *
 * @param geometry An {@link ExtrudeGeometry} with no extrusion depth, centered on z = 0
 * @param depth The bevelThickness the geometry was built with, which is where its faces are
 * @param halfWidth Half the width of the face, in px
 * @param halfHeight Half the height of the face, in px
 * @param radius The corner radius of the face, in px
 * @param lens How much the normals are tilted, as the slope of the surface they describe
 */
export function applyLens(
  geometry: BufferGeometry,
  depth: number,
  halfWidth: number,
  halfHeight: number,
  radius: number,
  lens: number
) {
  if (lens === 0 || depth <= 0) return geometry

  const pos = geometry.getAttribute("position")
  const normal = geometry.getAttribute("normal")
  const r = Math.max(0, Math.min(radius, halfWidth, halfHeight))

  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i)
    // only the faces, which are all that is left at the full depth
    if (Math.abs(Math.abs(z) - depth) > 1e-4) continue

    const x = pos.getX(i)
    const y = pos.getY(i)
    // which way is out: straight along the sides, and away from the center of the corner in the corners
    const qx = Math.abs(x) - (halfWidth - r)
    const qy = Math.abs(y) - (halfHeight - r)
    let ox: number
    let oy: number
    if (qx > 0 && qy > 0) {
      const len = Math.hypot(qx, qy) || 1
      ox = qx / len
      oy = qy / len
    } else if (qx > qy) {
      ox = 1
      oy = 0
    } else {
      ox = 0
      oy = 1
    }
    ox *= Math.sign(x) || 1
    oy *= Math.sign(y) || 1

    const nz = Math.sign(z)
    const len = Math.hypot(ox * lens, oy * lens, 1)
    normal.setXYZ(i, (ox * lens) / len, (oy * lens) / len, nz / len)
  }
  normal.needsUpdate = true
  return geometry
}
