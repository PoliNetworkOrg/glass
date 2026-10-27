import type { EdgeConfig, PlaneConfig, SceneConfig, ShapeConfig, SurfaceConfig, TintConfig } from "./types/schemas"

/** A named configuration of the glass, to be used as (or merged into) the `options` of a glass */
export type GlassPreset = {
  plane?: Partial<PlaneConfig>
  shape?: Partial<ShapeConfig>
  surface?: Partial<SurfaceConfig>
  tint?: Partial<TintConfig>
  edge?: Partial<EdgeConfig>
}

export type GlassPresetName = "regular" | "clear" | "tinted"

/**
 * Ready made configurations of the glass.
 *
 * - `regular` frosted glass, the one that comes by default
 * - `clear` almost no frost or tint, to get out of the way of what is behind it
 * - `tinted` colored glass, whose color is the one given to the glass
 *
 * They are plain options: use one as is, or through {@link withPreset} to change some of it.
 *
 * `plane.blur` is the blur of the whole captured background, shared by all the glass in a
 * {@link GlassProvider}, so it takes effect where the provider is given it. The frost of each
 * glass is `surface.frost`.
 */
export const glassPresets: Readonly<Record<GlassPresetName, Readonly<GlassPreset>>> = Object.freeze({
  regular: {
    plane: { blur: 2 },
    shape: { bezel: 16, shift: 25, curve: 2.5, scaling: 0.4, dispersion: 0 },
    surface: { frost: 4 },
    tint: { opacity: 0, saturate: 1 },
    edge: { rim: 1, stroke: 1, elevation: "default", shadow: 1, presence: 0 },
  },
  clear: {
    plane: { blur: 1 },
    shape: { bezel: 16, shift: 25, curve: 2.5, scaling: 0.4, dispersion: 0.1 },
    surface: { frost: 0 },
    tint: { opacity: 0.05, saturate: 1.2 },
    edge: { rim: 0.6, stroke: 0.75, elevation: "default", shadow: 0.55, presence: 0 },
  },
  tinted: {
    plane: { blur: 2 },
    shape: { bezel: 16, shift: 25, curve: 2.5, scaling: 0.4, dispersion: 0 },
    surface: { frost: 4 },
    tint: { opacity: 0.35, saturate: 1.4 },
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
