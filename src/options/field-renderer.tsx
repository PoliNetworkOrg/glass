import { PlusCircle } from "lucide-react"
import { z } from "zod"
import { Button } from "../components/ui/button"
import { Label } from "../components/ui/label"
import { Separator } from "../components/ui/separator"
import { Slider } from "../components/ui/slider"
import { Switch } from "../components/ui/switch"
import { formatLabel, getDefaultValues, getDescription, getNumberConstraints } from "./utils"

export type FieldRendererProps<T extends z.ZodType> = {
  schema: T
  value: z.infer<T>
  path: string[]
  onChange: (value: z.infer<T>) => void
}

export function FieldRenderer<T extends z.ZodType>({ schema: sk, value, path, onChange }: FieldRendererProps<T>) {
  const description = getDescription(sk)
  let schema: T
  if (sk.def.type === "default") {
    schema = (sk as unknown as z.ZodDefault).unwrap() as T
  } else {
    schema = sk
  }
  const fieldName = path[path.length - 1]
  const label = formatLabel(fieldName)
  const cb = (v: unknown) => onChange(v as z.infer<T>)

  // Handle boolean (switch)
  if (schema.def.type === "boolean") {
    return (
      <div className="flex items-center justify-between">
        <Label htmlFor={path.join(".")}>{label}</Label>
        <Switch id={path.join(".")} checked={Boolean(value)} onCheckedChange={cb} />
      </div>
    )
  }

  // Handle number (slider)
  if (schema.def.type === "number") {
    const { min, max, step } = getNumberConstraints(schema)

    return (
      <div className="space-y-2">
        <Label htmlFor={path.join(".")}>
          {label}: {typeof value === "number" ? value.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0) : "N/A"}
        </Label>
        <Slider
          id={path.join(".")}
          value={[value ? Number(value) : min]}
          onValueChange={([v]) => cb(v)}
          min={min}
          max={max}
          step={step}
        />
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    )
  }

  // Handle color tuple [r, g, b]
  if (schema.def.type === "tuple") {
    const items = (schema as unknown as z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber]>).def.items
    if (items.length === 3 && items.every((item) => item instanceof z.ZodNumber)) {
      const colorValue = (value as [number, number, number]) ?? [1, 1, 1]
      const colors = ["Red", "Green", "Blue"]
      const colorClasses = ["text-red-500", "text-green-500", "text-blue-500"]

      return (
        <div className="space-y-3">
          <div className="flex gap-4 h-full">
            <Label>{label}</Label>
            {/* Color Preview */}
            <div
              className="flex-1 rounded-xs border-2 m-0.5"
              style={{
                backgroundColor: `rgb(${colorValue[0] * 255}, ${colorValue[1] * 255}, ${colorValue[2] * 255})`,
              }}
            />
          </div>
          {colorValue.map((channelValue: number, index: number) => {
            const channelSchema = items[index]
            const { min, max, step } = getNumberConstraints(channelSchema)

            return (
              <div key={`${path.join(".")}-${index}`} className="flex gap-2">
                <Label className={`text-xs ${colorClasses[index]}`}>
                  {colors[index][0]}: {channelValue.toFixed(2)}
                </Label>
                <Slider
                  className="flex-1"
                  value={[channelValue]}
                  onValueChange={([v]) => {
                    const newColor = [...colorValue]
                    newColor[index] = v
                    cb(newColor)
                  }}
                  min={min}
                  max={max}
                  step={step}
                />
              </div>
            )
          })}
        </div>
      )
    }
  }

  // Handle object (recursive)
  if (schema.def.type === "object") {
    const shape = (schema as unknown as z.ZodObject).shape
    const objValue = value as Record<keyof typeof shape, (typeof shape)[keyof typeof shape]>

    return (
      <div className="space-y-4">
        <Separator />
        <h2 className="font-semibold">{label}</h2>
        {Object.keys(shape).map((key) => (
          <>
            <FieldRenderer
              key={`${path.join(".")}-${key}`}
              schema={shape[key]}
              value={objValue[key] as z.infer<(typeof shape)[typeof key]>}
              path={[...path, key]}
              onChange={(newValue) => {
                cb({ ...objValue, [key]: newValue })
              }}
            />
          </>
        ))}
      </div>
    )
  }

  // Handle array
  if (schema.def.type === "array") {
    const arrayValue = (value as unknown[]) ?? []
    const elementSchema = (schema as unknown as z.ZodArray).element as z.ZodType

    return (
      <div className="space-y-4">
        <h3 className="font-semibold">{label}</h3>
        {arrayValue.map((item: unknown, index: number) => (
          <div key={`${path.join(".")}-${index}`} className="pl-4 border-l-2 border-border">
            <FieldRenderer
              schema={elementSchema}
              value={item}
              path={[...path, `${label} #${index}`]}
              onChange={(newValue) => {
                const newArray = [...arrayValue]
                newArray[index] = newValue
                cb(newArray)
              }}
            />
          </div>
        ))}
        <Button
          variant="secondary"
          size="icon"
          onClick={() => cb([...arrayValue, getDefaultValues(elementSchema)])}
          className="m-2"
        >
          <PlusCircle className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return null
}
