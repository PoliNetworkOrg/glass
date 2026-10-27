import { Color } from "three"
import type { GlassTheme } from "../edge"

/**
 * Tells which theme a glass of the given color belongs to: a dark color is on a dark theme.
 *
 * @param color A CSS color the way three reads it (hex, `rgb()`, `hsl()` or a name)
 * @returns `dark` if the color is darker than a mid grey, `light` otherwise
 */
export function themeFromColor(color: string): GlassTheme {
  const { l } = new Color(color).getHSL({ h: 0, s: 0, l: 0 })
  return l < 0.5 ? "dark" : "light"
}

/**
 * Whether a color has a hue worth showing on the edges of a glass of that color, and isn't one of the neutral
 * whites and grays the regular glass is made of.
 */
export function isColored(color: string): boolean {
  const { r, g, b } = new Color(color)
  return Math.max(r, g, b) - Math.min(r, g, b) > 0.12
}
