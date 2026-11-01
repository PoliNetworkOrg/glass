import {
  type GlassPresetName,
  glassThemeTint,
  glassPresets,
  glassTints,
  type SceneConfig,
  SceneConfigSchema,
} from "@polinetwork/glass"
import { ChevronLeft, ChevronRight, Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { SchemaForm } from "./schema-form"
import { getDefaultValues } from "./utils"

export function DemoOptions(props: {
  onChange?: (options: SceneConfig) => void
  onDarkModeChange?: (isDark: boolean) => void
  isDarkMode?: boolean
  onPresetChange?: (preset: GlassPresetName) => void
  /** The color of the tinted preset */
  tintColor?: string
  onTintColorChange?: (color: string) => void
}) {
  const defaultConfig = getDefaultValues(SceneConfigSchema)
  const [config, setConfig] = useState<SceneConfig>(defaultConfig)
  const [preset, setPreset] = useState<GlassPresetName>("regular")
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    props.onChange?.(config)
  }, [config])

  // the regular glass is tinted less in the dark theme, as Apple's is
  const regularTint = (dark: boolean) => (dark ? glassThemeTint.dark : glassThemeTint.light)

  const handleDarkModeToggle = () => {
    props.onDarkModeChange?.(!props.isDarkMode)
    if (preset === "regular") setConfig((c) => ({ ...c, tint: { ...c.tint, ...regularTint(!props.isDarkMode) } }))
  }

  const handlePreset = (name: GlassPresetName) => {
    const p = glassPresets[name]
    setPreset(name)
    props.onPresetChange?.(name)
    setConfig((c) => ({
      plane: { ...c.plane, ...p.plane },
      shape: { ...c.shape, ...p.shape },
      surface: { ...c.surface, ...p.surface },
      tint: { ...c.tint, ...p.tint, ...(name === "regular" && regularTint(Boolean(props.isDarkMode))) },
      edge: { ...c.edge, ...p.edge },
    }))
  }

  const handleReset = () => handlePreset("regular")

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
            <CardTitle className="text-3xl">Scene Options</CardTitle>
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

            {/* Preset */}
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="preset">Preset</Label>
              <Select value={preset} onValueChange={(v) => handlePreset(v as GlassPresetName)}>
                <SelectTrigger id="preset" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(glassPresets) as GlassPresetName[]).map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Color of the tinted preset */}
            {preset === "tinted" && (
              <div className="space-y-2">
                <Label>Tint color</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {Object.entries(glassTints).map(([name, color]) => (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      aria-label={name}
                      onClick={() => props.onTintColorChange?.(color)}
                      className="size-6 rounded-full border-2 border-background ring-offset-1 ring-offset-background"
                      style={{
                        backgroundColor: color,
                        boxShadow: props.tintColor === color ? `0 0 0 2px ${color}` : "0 0 0 1px rgba(0,0,0,0.2)",
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    aria-label="Custom tint color"
                    value={props.tintColor}
                    onChange={(e) => props.onTintColorChange?.(e.target.value)}
                    className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
                  />
                </div>
              </div>
            )}

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
