import type { GlassTheme } from "../edge"

const parsed = new Map<string, [number, number, number] | null>()
let parser: CanvasRenderingContext2D | null | undefined

/**
 * The red, green and blue of a CSS color, 0 to 1, in linear light, which is how three.js held them, and so how the
 * theme of a glass has been told from its color. A 2D canvas reads any CSS color the browser does (a name, `hsl()`) and
 * is read back as pixels; without a document only hex and `rgb()` are read.
 */
function linearRgb(color: string): [number, number, number] | null {
  const cached = parsed.get(color)
  if (cached !== undefined) return cached

  const css = color.trim()
  let srgb: number[] | null = null
  if (typeof document !== "undefined") {
    if (parser === undefined) {
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = 1
      parser = canvas.getContext("2d", { willReadFrequently: true })
    }
    if (parser) {
      // one pixel read back is sRGB whatever the syntax of the color (`oklch()`, `lab()`, `color()`)
      parser.clearRect(0, 0, 1, 1)
      parser.fillStyle = "#000"
      parser.fillStyle = css
      parser.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = parser.getImageData(0, 0, 1, 1).data
      if (a > 0) srgb = [r, g, b].map((v) => v / 255)
    }
  }
  // without a document (or a canvas) only hex and rgb() are read
  const hex = srgb ? null : /^#([\da-f]{3}|[\da-f]{6})(?:[\da-f]{2})?$/i.exec(css)
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join("") : hex[1]
    const n = Number.parseInt(digits, 16)
    srgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255)
  } else if (!srgb) {
    const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(css)
    if (rgb) srgb = [rgb[1], rgb[2], rgb[3]].map((v) => Number(v) / 255)
  }
  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const linear = srgb ? (srgb.map(toLinear) as [number, number, number]) : null
  parsed.set(color, linear)
  return linear
}

/**
 * Tells which theme a glass of the given color belongs to: a dark color is on a dark theme.
 *
 * @param color A CSS color
 * @returns `dark` if the color is darker than a mid grey, `light` otherwise
 */
export function themeFromColor(color: string): GlassTheme {
  const [r, g, b] = linearRgb(color) ?? [1, 1, 1]
  // the lightness of HSL
  const l = (Math.max(r, g, b) + Math.min(r, g, b)) / 2
  return l < 0.5 ? "dark" : "light"
}

/**
 * Whether a color has a hue worth showing on the edges of a glass of that color, and isn't one of the neutral
 * whites and grays the regular glass is made of.
 */
export function isColored(color: string): boolean {
  const [r, g, b] = linearRgb(color) ?? [1, 1, 1]
  return Math.max(r, g, b) - Math.min(r, g, b) > 0.12
}
