import { Matrix2, Vector2, type Vector2Tuple } from "three"

/**
 * Get the direction vector in the XY plane from an angle in radians.
 * @param angle Angle in radians
 * @returns Normalized vector on the XY plane with length 1 (the z component will always be 0)
 */
export function dirFromAngle(angle: number): [number, number, number] {
  const rad = (angle * Math.PI) / 180
  const x = Math.sin(rad)
  const y = Math.cos(rad)
  return [x, y, 0]
}

export function diag(...vec: Vector2Tuple): Matrix2 {
  return new Matrix2(vec[0], 0, 0, vec[1])
}

export function det2(a: Matrix2): number {
  const e = a.elements
  return e[0] * e[3] - e[1] * e[2]
}

export function matrix2mult(a: Matrix2, b: Vector2): Vector2 {
  const e = a.elements
  return new Vector2(e[0] * b.x + e[2] * b.y, e[1] * b.x + e[3] * b.y)
}
