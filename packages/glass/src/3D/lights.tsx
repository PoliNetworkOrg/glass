import { useMemo } from "react"
import type { SceneConfig } from "../types/schemas"
import { dirFromAngle } from "../utils/math"

type LightingProps = {
  settings: SceneConfig["lighting"]
}

export function SceneLights({ settings }: LightingProps) {
  const { ambient, directional } = settings

  const ambientLight = <ambientLight color={ambient.color} intensity={ambient.intensity} />

  const directionalLights = useMemo(
    () =>
      directional.map((light, i) => (
        <directionalLight
          // biome-ignore lint/suspicious/noArrayIndexKey: Index is dependent on the scene config
          key={`directional-light-${i}`}
          color={light.color}
          intensity={light.intensity}
          position={dirFromAngle(light.position)}
          castShadow
        />
      )),
    [directional]
  )

  return (
    <>
      {ambientLight}
      {directionalLights}
    </>
  )
}
