import { z } from "zod"

// Extract default values from Zod schema
export function getDefaultValues<T extends z.ZodType>(schema: T): z.infer<T> {
  if (schema instanceof z.ZodDefault) {
    return schema.def.defaultValue as z.output<T>
  }
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape
    const defaults: Record<string, unknown> = {}
    for (const key in shape) {
      defaults[key] = getDefaultValues(shape[key])
    }
    return defaults as z.output<T>
  }
  if (schema instanceof z.ZodArray) {
    return [] as z.output<T>
  }
  if (schema instanceof z.ZodOptional) {
    return undefined as z.output<T>
  }
  return undefined as z.output<T>
}

// Get min/max/step from Zod number schema
export function getNumberConstraints(schema: z.ZodType): { min: number; max: number; step: number } {
  const cks = (schema.def.checks?.map((c) => c._zod.def) ?? []) as unknown[] as {
    check: string
    value: number
  }[]
  const min = cks.find(({ check }) => check === "greater_than")?.value ?? 0
  const max = cks.find(({ check }) => check === "less_than")?.value ?? 100

  // Determine step based on range
  const range = max - min
  const step = range > 10 ? 1 : range > 10 ? 0.1 : 0.01

  return { min, max, step }
}

export function getDescription(schema: z.ZodType): string | undefined {
  const meta = schema.meta()
  return meta?.description
}

// Format field name to human-readable label
export function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}
