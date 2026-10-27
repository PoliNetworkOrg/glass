import type { GlassConfig, PlaneConfig, SceneConfig, ShapeConfig, TintConfig } from "./types/schemas"

/** A named configuration of the glass, to be used as (or merged into) the `options` of a glass */
export type GlassPreset = {
  material?: Partial<GlassConfig>
  plane?: Partial<PlaneConfig>
  shape?: Partial<ShapeConfig>
  tint?: Partial<TintConfig>
}

export type GlassPresetName = "regular" | "clear" | "tinted"

const regular: GlassPreset = {
  material: {
    ior: 8,
    thickness: 100,
    transmission: 0.95,
    roughness: 0.1,
    chromaticAberration: 0.6,
    anisotropicBlur: 0.8,
    clearcoat: 1,
    clearcoatRoughness: 0.8,
    sheen: 0.5,
    iridescence: 0.5,
    attenuationColor: "#fefefe",
    attenuationDistance: 100,
  },
  plane: { blur: 2 },
  tint: { opacity: 0, saturate: 1 },
}

/**
 * Ready made configurations of the glass.
 *
 * - `regular` the glass as it comes
 * - `clear` less frost and tint, to get out of the way of what is behind it
 * - `tinted` colored glass, whose color is the one given to the glass
 *
 * They are plain options: use one as is, or through {@link withPreset} to change some of it.
 *
 * The blur of the background is the one of the {@link GlassProvider}, shared by all the glass
 * in it, so `plane.blur` takes effect where the provider is given it.
 */
export const glassPresets: Readonly<Record<GlassPresetName, Readonly<GlassPreset>>> = Object.freeze({
  regular,
  clear: {
    material: {
      ...regular.material,
      roughness: 0.02,
      thickness: 60,
      clearcoat: 0.5,
      sheen: 0.2,
      chromaticAberration: 0.3,
    },
    plane: { blur: 1 },
    tint: { opacity: 0.05, saturate: 1.8 },
  },
  tinted: {
    material: { ...regular.material },
    plane: { blur: 2 },
    tint: { opacity: 0.35, saturate: 1.4 },
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
 * <Glass options={withPreset("clear", { material: { roughness: 0.2 } })} ... />
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
