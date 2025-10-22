import type { z } from "zod"
import { FieldRenderer } from "./field-renderer"

export type SchemaFormProps<T extends z.ZodObject> = {
  schema: T
  value: z.infer<T>
  onChange: (value: z.infer<T>) => void
}

export function SchemaForm<T extends z.ZodObject>({ schema, value, onChange }: SchemaFormProps<T>) {
  const shape = schema.shape

  return (
    <div className="space-y-6">
      {Object.keys(shape).map((key) => (
        <div key={key}>
          <FieldRenderer
            schema={shape[key]}
            value={value[key]}
            path={[key]}
            onChange={(newValue) => {
              onChange({ ...value, [key]: newValue })
            }}
          />
        </div>
      ))}
    </div>
  )
}
