import type { BufferGeometry } from "three"

/**
 * Resizes a rounded geometry without distorting its corners or its bevel.
 *
 * Scaling the whole mesh would also scale the bevel and turn round corners into ellipses.
 * Instead, the part of the geometry within `region` px of an edge (the corners and the bevel)
 * is moved rigidly along with that edge, and only the middle, which is straight and has
 * nothing to distort, is stretched. The result is the same geometry that would have been built
 * for the new size, without building it.
 *
 * The normals are left alone: they don't change under this mapping.
 *
 * @param geometry The geometry to modify in place
 * @param base Its positions as they were when built at `from`
 * @param from The size it was built for
 * @param to The size to resize it to
 * @param region How far from the edges, in px, the corners and the bevel reach
 * @returns false if the size is too small for this to hold (the corners would overlap), and
 * the geometry has to be built again
 */
export function reshapeGeometry(
  geometry: BufferGeometry,
  base: Float32Array,
  from: { w: number; h: number },
  to: { w: number; h: number },
  region: number
): boolean {
  const dx = (to.w - from.w) / 2
  const dy = (to.h - from.h) / 2
  // half-size of the straight middle, before and after
  const tx = from.w / 2 - region
  const ty = from.h / 2 - region
  if (tx + dx < 1 || ty + dy < 1 || tx < 1 || ty < 1) return false

  const kx = (tx + dx) / tx
  const ky = (ty + dy) / ty
  const pos = geometry.getAttribute("position")
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3]
    const y = base[i * 3 + 1]
    pos.setXY(i, Math.abs(x) <= tx ? x * kx : x + Math.sign(x) * dx, Math.abs(y) <= ty ? y * ky : y + Math.sign(y) * dy)
  }
  pos.needsUpdate = true
  return true
}
