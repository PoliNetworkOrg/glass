import { defaultGlassOptions, type GlassOptions } from "@polinetwork/glass"
import { ChevronLeft, ChevronRight, Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"

export function DemoOptions(props: {
  onChange?: (options: GlassOptions) => void
  onDarkModeChange?: (isDark: boolean) => void
  isDarkMode?: boolean
}) {
  const [glassOptions, setGlassOptions] = useState<GlassOptions>(defaultGlassOptions)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    props.onChange?.(glassOptions)
  }, [glassOptions])

  const handleDarkModeToggle = () => {
    props.onDarkModeChange?.(!props.isDarkMode)
  }

  return (
    <div glass-ignore="" className="fixed right-0 top-0 z-[1000] max-h-screen">
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

            {/* Refraction */}
            <div className="space-y-2">
              <Label>Refraction: {glassOptions.refraction.toFixed(2)}</Label>
              <Slider
                value={[glassOptions.refraction]}
                onValueChange={([value]) => setGlassOptions({ ...glassOptions, refraction: value })}
                min={1.0}
                max={2.0}
                step={0.01}
              />
              <p className="text-xs text-muted-foreground">Index of refraction</p>
            </div>

            {/* Depth */}
            <div className="space-y-2">
              <Label>Depth: {glassOptions.depth.toFixed(2)}</Label>
              <Slider
                value={[glassOptions.depth]}
                onValueChange={([value]) => setGlassOptions({ ...glassOptions, depth: value })}
                min={0}
                max={1}
                step={0.01}
              />
              <p className="text-xs text-muted-foreground">Glass thickness</p>
            </div>

            {/* Dispersion */}
            <div className="space-y-2">
              <Label>Dispersion: {glassOptions.dispersion.toFixed(2)}</Label>
              <Slider
                value={[glassOptions.dispersion]}
                onValueChange={([value]) => setGlassOptions({ ...glassOptions, dispersion: value })}
                min={0}
                max={1}
                step={0.01}
              />
              <p className="text-xs text-muted-foreground">Chromatic dispersion</p>
            </div>

            {/* Frost */}
            <div className="space-y-2">
              <Label>Frost: {glassOptions.frost.toFixed(2)}</Label>
              <Slider
                value={[glassOptions.frost]}
                onValueChange={([value]) => setGlassOptions({ ...glassOptions, frost: value })}
                min={0}
                max={1}
                step={0.01}
              />
              <p className="text-xs text-muted-foreground">Surface roughness</p>
            </div>

            <Separator />

            {/* Light Properties */}
            <h3 className="font-semibold">Light Properties</h3>

            {/* Light Angle */}
            <div className="space-y-2">
              <Label>Angle: {glassOptions.light.angle}°</Label>
              <Slider
                value={[glassOptions.light.angle]}
                onValueChange={([value]) =>
                  setGlassOptions({
                    ...glassOptions,
                    light: { ...glassOptions.light, angle: value },
                  })
                }
                min={0}
                max={360}
                step={1}
              />
            </div>

            {/* Light Strength */}
            <div className="space-y-2">
              <Label>Strength: {glassOptions.light.strength.toFixed(1)}</Label>
              <Slider
                value={[glassOptions.light.strength]}
                onValueChange={([value]) =>
                  setGlassOptions({
                    ...glassOptions,
                    light: { ...glassOptions.light, strength: value },
                  })
                }
                min={0}
                max={10}
                step={0.1}
              />
            </div>

            {/* Light Directionality */}
            <div className="space-y-2">
              <Label>Directionality: {glassOptions.light.directionality.toFixed(2)}</Label>
              <Slider
                value={[glassOptions.light.directionality]}
                onValueChange={([value]) =>
                  setGlassOptions({
                    ...glassOptions,
                    light: { ...glassOptions.light, directionality: value },
                  })
                }
                min={0}
                max={1}
                step={0.01}
              />
            </div>

            {/* Light Color */}
            <div className="space-y-3">
              <Label>Light Color</Label>

              <div className="space-y-2">
                <Label className="text-xs text-red-500">R: {glassOptions.light.color[0].toFixed(2)}</Label>
                <Slider
                  value={[glassOptions.light.color[0]]}
                  onValueChange={([value]) =>
                    setGlassOptions({
                      ...glassOptions,
                      light: {
                        ...glassOptions.light,
                        color: [value, glassOptions.light.color[1], glassOptions.light.color[2]],
                      },
                    })
                  }
                  min={0}
                  max={1}
                  step={0.01}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-green-500">G: {glassOptions.light.color[1].toFixed(2)}</Label>
                <Slider
                  value={[glassOptions.light.color[1]]}
                  onValueChange={([value]) =>
                    setGlassOptions({
                      ...glassOptions,
                      light: {
                        ...glassOptions.light,
                        color: [glassOptions.light.color[0], value, glassOptions.light.color[2]],
                      },
                    })
                  }
                  min={0}
                  max={1}
                  step={0.01}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-blue-500">B: {glassOptions.light.color[2].toFixed(2)}</Label>
                <Slider
                  value={[glassOptions.light.color[2]]}
                  onValueChange={([value]) =>
                    setGlassOptions({
                      ...glassOptions,
                      light: {
                        ...glassOptions.light,
                        color: [glassOptions.light.color[0], glassOptions.light.color[1], value],
                      },
                    })
                  }
                  min={0}
                  max={1}
                  step={0.01}
                />
              </div>

              {/* Color Preview */}
              <div
                className="h-10 rounded-md border"
                style={{
                  backgroundColor: `rgb(${glassOptions.light.color[0] * 255}, ${glassOptions.light.color[1] * 255}, ${glassOptions.light.color[2] * 255})`,
                }}
              />
            </div>

            <Separator />

            {/* Reset Button */}
            <Button variant="outline" onClick={() => setGlassOptions(defaultGlassOptions)} className="w-full">
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
