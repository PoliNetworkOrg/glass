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
  ior: z.number().min(1).max(2.333).default(1.2).describe("Index of refraction."),
  roughness: z.number().min(0).max(1).default(0.6),
  reflectivity: z.number().min(0).max(1).default(0.2),
  dispersion: z.number().min(0).max(10).default(2),

  transmission: z.object({
    enabled: z.boolean().default(true),
    value: z.number().min(0).max(1).default(0.8),
    thickness: z.number().min(0).max(1).default(0.6),
    attenuationColor: ColorSchema,
    attenuationDistance: z.number().min(10).max(100000).default(10000),
  }),

  emissive: z.object({
    enabled: z.boolean().default(true),
    color: ColorSchema.default([1, 1, 1]),
    intensity: z.number().min(0).max(1).default(0.1),
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
})

export const LightingSchema = z.object({
  ambient: z.object({
    color: ColorSchema,
    intensity: z.number().min(0).max(10).default(2),
  }),

  directional: z
    .array(
      z.object({
        color: ColorSchema,
        intensity: z.number().min(0).max(10).default(3),
        position: z.number().min(0).max(360).default(0).describe("Euler angle of rotation relative to the XY plane"),
      })
    )
    .default([
      {
        color: [1, 1, 1],
        intensity: 1,
        position: 45,
      },
    ]),
})

export const SceneConfigSchema = z.object({
  material: PhysicalMaterialSchema,
  lighting: LightingSchema,
})

export type GlassConfig = z.infer<typeof PhysicalMaterialSchema>
export type SceneConfig = z.infer<typeof SceneConfigSchema>
