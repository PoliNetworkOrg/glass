/**
 * Resolves the top-left border radius of a computed style to pixels.
 *
 * Computed styles already turn `rem`/`em` into px, but keep percentages as they are,
 * so those are resolved against the shortest side, like CSS does. When the
 * radius is given as two values (`16px 8px`) only the horizontal one is used.
 * The result is clamped to half the shortest side, so a pill gives a capsule.
 *
 * @param style The computed style of the element
 * @returns The effective corner radius in px
 */
export function parseBorderRadius(style: CSSStyleDeclaration): number {
  const w = Number.parseFloat(style.width) || 0
  const h = Number.parseFloat(style.height) || 0
  const half = Math.min(w, h) / 2

  const raw = style.borderTopLeftRadius.split(" ")[0]
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) return 0

  const px = raw.endsWith("%") ? (Math.min(w, h) * value) / 100 : value
  return Math.max(0, half > 0 ? Math.min(px, half) : px)
}
