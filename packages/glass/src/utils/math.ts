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
