import { z } from "zod"

export const PlaneSchema = z
  .object({
    blur: z.number().min(0).max(100).default(0).meta({ description: "Blur amount for the background plane." }),
  })
  .default({ blur: 0 })

export const ShapeSchema = z
  .object({
    bezel: z.number().min(1).max(64).default(16).meta({
      description: "Width of the bent band at the edge, in px. Grows with the element past 64px, see scaling.",
    }),
    curve: z.number().min(0.5).max(6).default(2.5).meta({
      description:
        "How the bend grows toward the rim. Higher values keep the face flat longer and bend more at the edge.",
    }),
    shift: z
      .number()
      .min(0)
      .max(64)
      .default(25)
      .meta({ description: "How far in from the rim the very edge samples, in px. Grows with the element past 64px." }),
    scaling: z.number().min(0).max(1).default(0.4).meta({
      description:
        "How much the bezel and shift grow on elements larger than 64px. 0 keeps them as set, 1 makes them proportional to the size.",
    }),
    dispersion: z.number().min(0).max(1).default(0).meta({
      description: "How much further the red bends than the blue, to split the colors at the rim.",
    }),
  })
  .default({ bezel: 16, curve: 2.5, shift: 25, scaling: 0.4, dispersion: 0 })

export const SurfaceSchema = z
  .object({
    frost: z.number().min(0).max(32).default(2).meta({
      description: "How much the glass blurs what is behind it, in px. 0 is clear glass.",
    }),
  })
  .default({ frost: 2 })

export const TintSchema = z
  .object({
    opacity: z
      .number()
      .min(0)
      .max(1)
      .default(0.66)
      .meta({ description: "How much of the glass color is laid over the glass. 0 is plain glass." }),
    saturate: z.number().min(0.5).max(3).default(1).meta({
      description: "Saturation of what is seen through the glass. Keeps a tint from dragging the hue of the backdrop.",
    }),
  })
  .default({ opacity: 0.66, saturate: 1 })

export const EdgeSchema = z
  .object({
    rim: z
      .number()
      .min(0)
      .max(1)
      .default(1)
      .meta({ description: "Strength of the highlight on the edges of the glass. 0 is none." }),
    stroke: z
      .number()
      .min(0)
      .max(1)
      .default(1)
      .meta({ description: "Strength of the hairline stroke around the glass. 0 is none." }),
    elevation: z
      .enum(["low", "default", "high", "extra-high"])
      .default("default")
      .meta({ description: "How high the glass floats, which shapes the shadow it casts." }),
    shadow: z
      .number()
      .min(0)
      .max(1)
      .default(1)
      .meta({ description: "Strength of the shadow the glass casts. 0 is none." }),
    presence: z
      .number()
      .min(0)
      .max(1)
      .default(0)
      .meta({ description: "A faint, tight shadow kept at every elevation, for glass that would read flat." }),
  })
  .default({ rim: 1, stroke: 1, elevation: "default", shadow: 1, presence: 0 })

export const SceneConfigSchema = z.object({
  plane: PlaneSchema,
  shape: ShapeSchema,
  surface: SurfaceSchema,
  tint: TintSchema,
  edge: EdgeSchema,
})

export type SceneConfig = z.infer<typeof SceneConfigSchema>
export type ShapeConfig = z.infer<typeof ShapeSchema>
export type SurfaceConfig = z.infer<typeof SurfaceSchema>
export type TintConfig = z.infer<typeof TintSchema>
export type EdgeConfig = z.infer<typeof EdgeSchema>
export type PlaneConfig = z.infer<typeof PlaneSchema>
