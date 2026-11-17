/**
 * Resolves the top-left border radius of a computed style to pixels.
 *
 * Computed styles already turn `rem`/`em` into px, but keep percentages as they are,
 * so those are resolved against the shortest side, like CSS does. When the
 * radius is given as two values (`16px 8px`) only the horizontal one is used.
 * The result is not clamped to the size, as it is read once and the element may resize.
 *
 * @param style The computed style of the element
 * @returns The effective corner radius in px
 */
export function parseBorderRadius(style: CSSStyleDeclaration): number {
  const w = Number.parseFloat(style.width) || 0
  const h = Number.parseFloat(style.height) || 0

  const raw = style.borderTopLeftRadius.split(" ")[0]
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) return 0

  const px = raw.endsWith("%") ? (Math.min(w, h) * value) / 100 : value
  // not clamped here: it is read once, so a clamp would pin a pill to the size it had then. It is clamped where it is
  // drawn, by CSS itself and by profileUniforms, against the size of that frame
  return Math.max(0, px)
}

/**
 * Resolves the superellipse exponent of the corners from a computed `corner-shape`.
 *
 * `round` is a circular corner (exponent 2), `squircle` is 4, and `superellipse(K)` is `2 ** K`.
 * Anything else, or a browser without `corner-shape`, gives a circular corner.
 *
 * @param style The computed style of the element
 * @returns The superellipse exponent of the corners
 */
export function parseCornerExponent(style: CSSStyleDeclaration): number {
  const shape = style.getPropertyValue("corner-top-left-shape") || style.getPropertyValue("corner-shape")
  if (shape.startsWith("squircle")) return 4
  const match = /superellipse\(\s*(-?[\d.]+)/.exec(shape)
  return match ? Math.max(1, 2 ** Number.parseFloat(match[1])) : 2
}
