import { GlassContext } from "./context"
import { useBackgroundTexture } from "./utils/hooks"

export type GlassProviderProps = {
  children: React.ReactNode
}

export function GlassProvider(props: GlassProviderProps) {
  const texture = useBackgroundTexture()
  return <GlassContext.Provider value={{ texture }}>{props.children}</GlassContext.Provider>
}
