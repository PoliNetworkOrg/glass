export type Dimensions = {
  width: number
  height: number
}

export type Light = {
  angle: number
  strength: number
  color: [number, number, number]
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
