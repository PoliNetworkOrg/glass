/** Options for the light source in the scene */
export type Light = {
  /** Angle of the light source */
  angle: number
  /** Strength of the light source */
  strength: number
  /** How the light is distributed (0 = fully ambient, 1 = fully directional) */
  directionality: number
  /** Color of the light source ([1, 1, 1] is white) */
  color: Readonly<[number, number, number]>
}

/** Options for the glass material */
export type GlassOptions = {
  /** Index of refraction for the material */
  refraction: number
  /** Depth of the material (relative to its size, 0 is a thin walled material while 1 is fully thick) */
  depth: number
  /** Dispersion of the material */
  dispersion: number
  /** Frostiness (roughness) of the material */
  frost: number
  /** Light settings for the element */
  light: Light
}

/** Default glass material options */
export const defaultGlassOptions: Readonly<GlassOptions> = Object.freeze({
  depth: 0.6,
  frost: 0.5,
  dispersion: 0.2,
  refraction: 1.2,
  light: {
    angle: 45,
    color: [1, 1, 1],
    directionality: 0.5,
    strength: 6,
  },
} as const)
