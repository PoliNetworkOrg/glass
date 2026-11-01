import type { EdgeConfig, PlaneConfig, SceneConfig, ShapeConfig, SurfaceConfig, TintConfig } from "./types/schemas"

/** A named configuration of the glass, to be used as (or merged into) the `options` of a glass */
export type GlassPreset = {
  plane?: Partial<PlaneConfig>
  shape?: Partial<ShapeConfig>
  surface?: Partial<SurfaceConfig>
  tint?: Partial<TintConfig>
  edge?: Partial<EdgeConfig>
}

/**
 * Colors to give a `regular` or `clear` glass as its `color`, for a light and a dark interface: the neutral
 * glass of Apple's, as measured on its tab bar (over a page of `#1c1c1e` the dark one comes out at the same
 * gray as the bar does). The dark one is made to go with {@link glassThemeTint}`.dark`, which it was measured
 * with: on its own, over the plain `regular` tint, it comes out darker than Apple's.
 */
export const glassColors = Object.freeze({
  light: "#f8fafc",
  dark: "#434345",
} as const)

/**
 * The `tint` of the `regular` glass for a light and a dark interface. The dark glass of Apple's lets through more of
 * what is behind it than the light one, and lifts its shadows: measured on Safari's toolbar in dark mode it turns
 * black into `#1d1d1d`, near white into `#a5aaaf` and a page of `#030512` into `#262738`, which is the glass color
 * at this opacity laid over the backdrop raised to the power of `lift`.
 */
export const glassThemeTint = Object.freeze({
  light: { opacity: 0.66, lift: 1 },
  dark: { opacity: 0.43, lift: 0.67 },
} as const)

/**
 * Colors to give a `tinted` glass as its `color`: the system colors of Apple's interfaces, with `blue` the one to
 * start from.
 */
export const glassTints = Object.freeze({
  blue: "#007aff",
  teal: "#30b0c7",
  green: "#34c759",
  yellow: "#ffcc00",
  orange: "#ff9500",
  red: "#ff3b30",
  pink: "#ff2d55",
  purple: "#af52de",
} as const)

export type GlassPresetName = "regular" | "clear" | "tinted"

/**
 * Ready made configurations of the glass.
 *
 * - `regular` the one that comes by default: a light frost under a strong tint of the glass color (neutral for
 *   a neutral color), as measured on Apple's tab bar
 * - `clear` half the tint and frost, and the colors of what is behind it pushed up, to get out of the way of it
 * - `tinted` colored glass, whose color is the one given to the glass (see {@link glassTints}, `blue` is a good one)
 *
 * They are plain options: use one as is, or through {@link withPreset} to change some of it.
 *
 * `plane.blur` is the blur of the whole captured background, shared by all the glass in a
 * {@link GlassProvider}, so it takes effect where the provider is given it. The frost of each
 * glass is `surface.frost`.
 */
export const glassPresets: Readonly<Record<GlassPresetName, Readonly<GlassPreset>>> = Object.freeze({
  regular: {
    plane: { blur: 0 },
    shape: { bezel: 16, shift: 25, curve: 2.5, scaling: 0.4, dispersion: 0 },
    surface: { frost: 2 },
    tint: { opacity: 0.66, saturate: 1, lift: 1 },
    edge: { rim: 1, stroke: 1, elevation: "default", shadow: 1, presence: 0 },
  },
  clear: {
    plane: { blur: 0 },
    shape: { bezel: 16, shift: 25, curve: 2.5, scaling: 0.4, dispersion: 0 },
    surface: { frost: 1 },
    tint: { opacity: 0.35, saturate: 1.8, lift: 1 },
    edge: { rim: 0.6, stroke: 0.75, elevation: "default", shadow: 0.55, presence: 0 },
  },
  tinted: {
    plane: { blur: 0 },
    shape: { bezel: 16, shift: 25, curve: 2.5, scaling: 0.4, dispersion: 0 },
    surface: { frost: 2 },
    tint: { opacity: 0.6, saturate: 1, lift: 1 },
    edge: { rim: 1, stroke: 1, elevation: "default", shadow: 1, presence: 1 },
  },
})

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

function merge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) return (override === undefined ? base : override) as T
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(override)) out[key] = merge(out[key], value)
  return out as T
}

/**
 * A preset, with some of its options changed.
 *
 * @example
 * <Glass options={withPreset("clear", { surface: { frost: 8 } })} ... />
 *
 * @param name The preset to start from
 * @param overrides What to change, merged in depth
 * @returns Options for a glass
 */
export function withPreset(
  name: GlassPresetName,
  overrides: Partial<SceneConfig> | GlassPreset = {}
): Partial<SceneConfig> {
  return merge(glassPresets[name], overrides) as Partial<SceneConfig>
}
