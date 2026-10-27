import { ShapePath } from "three"

/**
 * Create a rounded rectangle shape path.
 *
 * The corners are superellipses (`|x/r|^n + |y/r|^n = 1`): an exponent of 2 is a circular
 * corner, 4 is a squircle. The path goes clockwise, starting on the top edge.
 *
 * @param width Width of the rectangle (outer)
 * @param height Height of the rectangle (outer)
 * @param radius Corner radius
 * @param exponent Superellipse exponent of the corners
 * @param segments Number of segments used to approximate each corner
 * @returns A ShapePath representing the rounded rectangle
 */
export function createRoundedRect(
  width: number,
  height: number,
  radius: number,
  exponent: number = 2,
  segments: number = 16
): ShapePath {
  const path = new ShapePath()

  const w = width / 2 // half-width
  const h = height / 2 // half-height
  const r = Math.min(radius, w, h) // effective radius
  const k = 2 / Math.max(exponent, 0.1)

  // corners in the order they are met going clockwise from the top edge, with the
  // direction in which the arc parameter has to run to follow the path
  const corners = [
    { sx: 1, sy: 1, reverse: true },
    { sx: 1, sy: -1, reverse: false },
    { sx: -1, sy: -1, reverse: true },
    { sx: -1, sy: 1, reverse: false },
  ]

  const points = corners.flatMap(({ sx, sy, reverse }) =>
    Array.from({ length: segments + 1 }, (_, i) => {
      const t = ((reverse ? segments - i : i) / segments) * (Math.PI / 2)
      return [sx * (w - r + r * Math.cos(t) ** k), sy * (h - r + r * Math.sin(t) ** k)] as const
    })
  )

  path.moveTo(...points[points.length - 1])
  for (const p of points) path.lineTo(...p)

  return path
}
