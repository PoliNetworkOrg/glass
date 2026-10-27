import {
  type GlassConfig,
  type GlassPresetName,
  glassPresets,
  type SceneConfig,
  SceneConfigSchema,
} from "@polinetwork/glass"
// import type { MeshTransmissionMaterialProps } from "@react-three/drei"
import { Leva, useControls } from "leva"
import { ChevronLeft, ChevronRight, Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SchemaForm } from "./schema-form"
import { getDefaultValues } from "./utils"

export function DemoOptions(props: {
  onChange?: (options: SceneConfig) => void
  onDarkModeChange?: (isDark: boolean) => void
  isDarkMode?: boolean
}) {
  // first, so it is the first thing in the panel
  const { preset } = useControls("Preset", {
    preset: { value: "regular" as GlassPresetName, options: Object.keys(glassPresets) as GlassPresetName[] },
  })
  const [material, setMaterial] = useControls(() => ({
    dithering: true,
    color: "#ffffff",
    emissive: "#000000",
    esmissiveIntensity: {
      min: 0,
      max: 10,
      value: 0,
      step: 0.01,
    },
    anisotropy: {
      min: 0,
      max: 1,
      value: 0,
      step: 0.01,
    },
    anisotropyRotation: {
      min: 0,
      max: Math.PI,
      value: 0,
      step: 0.01,
    },
    attenuationColor: "#fefefe",
    attenuationDistance: {
      min: 0,
      max: 100,
      value: 100,
      step: 0.01,
    },
    clearcoat: {
      min: 0,
      max: 1,
      value: 1,
      step: 0.01,
    },
    clearcoatRoughness: {
      min: 0,
      max: 1,
      value: 0.8,
      step: 0.01,
    },
    clearcoatColor: "#ffffff",
    dispersion: {
      min: 0,
      max: 1,
      value: 0,
      step: 0.01,
    },
    ior: {
      min: 1,
      max: 10,
      value: 8,
      step: 0.01,
    },
    iridescence: {
      min: 0,
      max: 1,
      value: 0.5,
      step: 0.01,
    },
    iridescenceIOR: {
      min: 1,
      max: 2.333,
      value: 5,
      step: 0.01,
    },
    iridescenceThicknessRange: {
      value: [100, 400],
    },
    sheen: {
      min: 0,
      max: 1,
      value: 0.5,
      step: 0.01,
    },
    sheenColor: "#ffffff",
    specularIntensity: {
      min: 0,
      max: 1,
      value: 0,
      step: 0.01,
    },
    specularColor: "#ffffff",
    thickness: {
      min: 0,
      max: 200,
      value: 100,
      step: 0.01,
    },
    transmission: {
      min: 0,
      max: 1,
      value: 0.95,
      step: 0.01,
    },

    roughness: {
      min: 0,
      max: 1,
      value: 0.1,
      step: 0.01,
    },
    chromaticAberration: {
      min: 0,
      max: 1,
      value: 0.6,
      step: 0.01,
    },
    anisotropicBlur: {
      min: 0,
      max: 1,
      value: 0.8,
      step: 0.01,
    },
    transmissionSampler: false,
    backside: false,
    resolution: {
      min: 16,
      max: 1024,
      value: 256,
      step: 16,
    },
    backsideResolution: {
      min: 16,
      max: 1024,
      value: 256,
      step: 16,
    },
    samples: {
      min: 1,
      max: 64,
      value: 16,
      step: 1,
    },
  }))
  const defaultConfig = getDefaultValues(SceneConfigSchema)
  const [scf, setConfig] = useState<SceneConfig>(defaultConfig)
  const [isVisible, setIsVisible] = useState(true)
  const config = { ...scf, material: material as GlassConfig }

  useEffect(() => {
    props.onChange?.(config)
  }, [scf, material])

  const handleDarkModeToggle = () => {
    props.onDarkModeChange?.(!props.isDarkMode)
  }

  useEffect(() => {
    handlePreset(preset)
  }, [preset])

  const handlePreset = (name: GlassPresetName) => {
    const p = glassPresets[name]
    setConfig((c) => ({
      ...c,
      plane: { ...c.plane, ...p.plane },
      shape: { ...c.shape, ...p.shape },
      tint: { ...c.tint, ...p.tint },
      edge: { ...c.edge, ...p.edge },
    }))
    setMaterial(p.material as Parameters<typeof setMaterial>[0])
  }

  const handleReset = () => {
    setConfig(defaultConfig)
  }

  return (
    <div glass-ignore="" className="fixed flex right-0 top-0 z-[1000] max-h-screen">
      {/* leva sits at the same corner as this panel and would cover it, so it is moved to the left edge */}
      <Leva titleBar={{ position: { x: -(window.innerWidth - 300), y: 0 } }} />
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
