import { ShapePath, Vector2 } from "three"
import { det2, diag, matrix2mult } from "./math"

const sqrPoints = [diag(1, 1), diag(1, -1), diag(-1, -1), diag(-1, 1)] as const
const offsetTemplates = [
  [new Vector2(1, 0), new Vector2(0, 1)],
  [new Vector2(0, 1), new Vector2(1, 0)],
]

export function createRoundedRect(width: number, height: number, radius: number): ShapePath {
  const path = new ShapePath()

  const w = width / 2
  const h = height / 2
  const r = Math.min(radius, w, h)

  const vertVec = new Vector2(w, h)
  const templs = offsetTemplates.map((t) => t.map((v) => v.clone().multiplyScalar(r)))

  const vs = sqrPoints.map((m) => {
    const concordant = det2(m) > 0
    const [offEnd, offNew] = templs[concordant ? 0 : 1]

    return {
      endl: matrix2mult(m, vertVec.clone().sub(offEnd)),
      ctrl: matrix2mult(m, vertVec.clone()),
      newl: matrix2mult(m, vertVec.clone().sub(offNew)),
    }
  })

  path.moveTo(vs[3].newl.x, vs[3].newl.y)

  for (const vertex of vs) {
    path.lineTo(vertex.endl.x, vertex.endl.y)
    path.quadraticCurveTo(vertex.ctrl.x, vertex.ctrl.y, vertex.newl.x, vertex.newl.y)
  }

  return path
}
