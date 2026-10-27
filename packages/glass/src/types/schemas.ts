import type { MeshTransmissionMaterialProps } from "@react-three/drei"
import { z } from "zod"

export const ColorSchema = z
  .tuple([
    z.number().min(0).max(1).describe("Red channel"),
    z.number().min(0).max(1).describe("Green channel"),
    z.number().min(0).max(1).describe("Blue channel"),
  ])
  .default([1, 1, 1])

export const PhysicalMaterialSchema = z.object({
  color: ColorSchema,
  ior: z.number().min(1).max(2.333).default(1.2).meta({ description: "Index of refraction." }),
  roughness: z.number().min(0).max(1).default(0.6).meta({ description: "Surface roughness." }),
  dispersion: z.number().min(0).max(10).default(2).meta({ description: "Chromatic dispersion." }),

  transmission: z.object({
    enabled: z.boolean().default(true),
    value: z.number().min(0).max(1).default(0.8),
    thickness: z.number().min(0).max(1).default(0.6),
    attenuationColor: ColorSchema,
    attenuationDistance: z.number().min(1).max(1000).default(1000),
  }),

  sheen: z.object({
    enabled: z.boolean().default(true),
    color: ColorSchema,
    strength: z.number().min(0).max(1).default(0.8),
    roughness: z.number().min(0).max(1).default(0.8),
  }),

  iridescence: z.object({
    enabled: z.boolean().default(true),
    strength: z.number().min(0).max(1).default(0.5),
    ior: z.number().min(1).max(2.5).default(1.5),
  }),

  clearcoat: z.object({
    enabled: z.boolean().default(true),
    strength: z.number().min(0).max(1).default(0.5),
    roughness: z.number().min(0).max(1).default(0.8),
  }),

  metalness: z.object({
    enabled: z.boolean().default(false),
    strength: z.number().min(0).max(1).default(0),
  }),

  emission: z.object({
    enabled: z.boolean().default(false),
    color: ColorSchema,
    intensity: z.number().min(0).max(1).default(0.1),
  }),
})

export const PlaneSchema = z.object({
  blur: z.number().min(0).max(100).default(2).meta({ description: "Blur amount for the background plane." }),
})

export const ShapeSchema = z
  .object({
    bezel: z
      .number()
      .min(1)
      .max(64)
      .default(16)
      .meta({ description: "Width of the beveled edge, in px. Fixed, it does not scale with the element." }),
    depth: z
      .number()
      .min(0)
      .max(64)
      .default(16)
      .meta({ description: "How far the bevel rises from the face, in px. Higher values bend the backdrop more." }),
    curve: z.number().min(0.5).max(6).default(2.5).meta({
      description: "How the bevel slopes toward the rim. Higher values keep it flat longer and bend more at the edge.",
    }),
  })
  .default({ bezel: 16, depth: 16, curve: 2.5 })

export const TintSchema = z
  .object({
    opacity: z
      .number()
      .min(0)
      .max(1)
      .default(0)
      .meta({ description: "How much of the glass color is laid over the glass. 0 is plain glass." }),
    saturate: z.number().min(0.5).max(3).default(1).meta({
      description: "Saturation of what is seen through the glass. Keeps a tint from dragging the hue of the backdrop.",
    }),
  })
  .default({ opacity: 0, saturate: 1 })

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
  })
  .default({ rim: 1, stroke: 1 })

export const LightingSchema = z
  .object({
    ambient: z.object({
      color: ColorSchema,
      intensity: z.number().min(0).max(10).default(3),
    }),

    directional: z
      .array(
        z.object({
          color: ColorSchema,
          intensity: z.number().min(0).max(10).default(0),
          position: z.number().min(0).max(360).default(0).describe("Euler angle of rotation relative to the XY plane"),
        })
      )
      .default([
        {
          color: [1, 1, 1],
          intensity: 3,
          position: 45,
        },
      ]),
  })
  .default({
    ambient: {
      color: [0.8, 0.8, 1],
      intensity: 3,
    },
    directional: [
      {
        color: [1, 0.8, 0.8],
        intensity: 10,
        position: 45,
      },
      {
        color: [0.8, 1, 0.8],
        intensity: 10,
        position: 135,
      },
    ],
  })

export const SceneConfigSchema = z.object({
  material: z.any().default({}),
  plane: PlaneSchema,
  shape: ShapeSchema,
  tint: TintSchema,
  edge: EdgeSchema,
  lighting: LightingSchema,
})

export type GlassConfig = MeshTransmissionMaterialProps
export type SceneConfig = z.infer<typeof SceneConfigSchema> & {
  material: GlassConfig
}
export type ShapeConfig = z.infer<typeof ShapeSchema>
export type TintConfig = z.infer<typeof TintSchema>
export type EdgeConfig = z.infer<typeof EdgeSchema>
export type PlaneConfig = z.infer<typeof PlaneSchema>
