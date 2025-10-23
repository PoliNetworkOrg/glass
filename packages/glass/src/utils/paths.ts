import { ShapePath, Vector2 } from "three"
import { det2, diag, matrix2mult } from "./math"

// vertex coordinates of a unit square
const sqrPoints = [diag(1, 1), diag(1, -1), diag(-1, -1), diag(-1, 1)] as const
// templates for the offsets of the rounded corner start/end points
const offsetTemplates = [
  [new Vector2(1, 0), new Vector2(0, 1)],
  [new Vector2(0, 1), new Vector2(1, 0)],
]

/**
 * Create a rounded rectangle shape path
 * @param width Width of the rectangle (outer)
 * @param height Height of the rectangle (outer)
 * @param radius Corner radius
 * @returns A ShapePath representing the rounded rectangle
 */
export function createRoundedRect(width: number, height: number, radius: number): ShapePath {
  const path = new ShapePath()

  const w = width / 2 // half-width
  const h = height / 2 // half-height
  const r = Math.min(radius, w, h) // effective radius

  const vertVec = new Vector2(w, h) // coordinates of the corner vertex
  // templates with offsets for the side end and start points, at the edge of the rounded corner
  const templs = offsetTemplates.map((t) => t.map((v) => v.clone().multiplyScalar(r)))

  const vs = sqrPoints.map((m) => {
    const concordant = det2(m) > 0 // I/III quadrants are concordant (when det of the diagonal matrix representing the point is positive)
    const [offEnd, offNew] = templs[concordant ? 0 : 1] // offsets from template

    return {
      endl: matrix2mult(m, vertVec.clone().sub(offEnd)), // end of the straight edge
      ctrl: matrix2mult(m, vertVec.clone()), // control point for the quadratic curve (corner point)
      newl: matrix2mult(m, vertVec.clone().sub(offNew)), // start of the new straight edge
    }
  })

  // move to the first corner start point (last edge in the array)
  path.moveTo(vs[3].newl.x, vs[3].newl.y)

  for (const vertex of vs) {
    // line to the end of the current edge
    path.lineTo(vertex.endl.x, vertex.endl.y)
    // quadratic curve around the corner to the start of the new edge
    path.quadraticCurveTo(vertex.ctrl.x, vertex.ctrl.y, vertex.newl.x, vertex.newl.y)
  }

  return path
}
