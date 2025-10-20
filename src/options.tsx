import { type SceneConfig, SceneConfigSchema } from "@polinetwork/glass"
import { ChevronLeft, ChevronRight, Moon, PlusCircle, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"

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
function getNumberConstraints(schema: z.ZodType): { min: number; max: number; step: number } {
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

// Format field name to human-readable label
function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .replace(/(\d)/g, "[$1]")
    .trim()
}

type FieldRendererProps<T extends z.ZodType> = {
  schema: T
  value: z.infer<T>
  path: string[]
  onChange: (value: z.infer<T>) => void
}

function FieldRenderer<T extends z.ZodType>({ schema: sk, value, path, onChange }: FieldRendererProps<T>) {
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
    const description = schema.description

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
        <h3 className="font-semibold">{label}</h3>
        {Object.keys(shape).map((key) => (
          <>
            <FieldRenderer
              key={key}
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
              path={[...path, String(index)]}
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

type SchemaFormProps<T extends z.ZodObject> = {
  schema: T
  value: z.infer<T>
  onChange: (value: z.infer<T>) => void
}

function SchemaForm<T extends z.ZodObject>({ schema, value, onChange }: SchemaFormProps<T>) {
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

export function DemoOptions(props: {
  onChange?: (options: SceneConfig) => void
  onDarkModeChange?: (isDark: boolean) => void
  isDarkMode?: boolean
}) {
  const defaultConfig = getDefaultValues(SceneConfigSchema)
  const [config, setConfig] = useState<SceneConfig>(defaultConfig)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    props.onChange?.(config)
  }, [config])

  const handleDarkModeToggle = () => {
    props.onDarkModeChange?.(!props.isDarkMode)
  }

  const handleReset = () => {
    setConfig(defaultConfig)
  }

  return (
    <div glass-ignore="" className="fixed flex right-0 top-0 z-[1000] max-h-screen">
      <Button
        variant="secondary"
        size="icon"
        onClick={() => setIsVisible(!isVisible)}
        className="m-2"
        title={isVisible ? "Hide Options" : "Show Options"}
      >
        {isVisible ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      {isVisible && (
        <Card className="w-80 max-h-screen overflow-y-auto rounded-lg border-l">
          <CardHeader>
            <CardTitle>Glass Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dark Mode Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="dark-mode" className="flex items-center gap-2">
                {props.isDarkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                {props.isDarkMode ? "Dark" : "Light"} Mode
              </Label>
              <Switch id="dark-mode" checked={props.isDarkMode} onCheckedChange={handleDarkModeToggle} />
            </div>

            <Separator />

            {/* Schema-generated form */}
            <SchemaForm schema={SceneConfigSchema} value={config} onChange={setConfig} />

            {/* Reset Button */}
            <Button variant="outline" onClick={handleReset} className="w-full">
              Reset to Defaults
            </Button>

            {/* GitHub Link */}
            <Button variant="link" asChild className="w-full">
              <a href="https://github.com/PoliNetworkOrg/glass/issues/new" target="_blank" rel="noopener noreferrer">
                Report a Bug
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
