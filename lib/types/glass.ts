export type Dimensions = {
  width: number
  height: number
}

export type Light = {
  angle: number
  strength: number
  directionality: number
  color: Readonly<[number, number, number]>
}

export type GlassOptions = {
  refraction: number
  depth: number
  dispersion: number
  frost: number
  light: Light
}

export type GlassElement = {
  dimensions: Dimensions
  options: GlassOptions
}

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
