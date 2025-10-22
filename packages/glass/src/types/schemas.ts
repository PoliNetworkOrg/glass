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
  lighting: LightingSchema,
})

export type GlassConfig = MeshTransmissionMaterialProps
export type SceneConfig = z.infer<typeof SceneConfigSchema> & {
  material: GlassConfig
}
export type PlaneConfig = z.infer<typeof PlaneSchema>
