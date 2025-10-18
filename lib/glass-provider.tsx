import { GlassContext } from "./context"
import { useBackgroundTexture } from "./utils/hooks"

export type GlassProviderProps = {
  children: React.ReactNode
  deps?: unknown[]
}

export function GlassProvider(props: GlassProviderProps) {
  const texture = useBackgroundTexture(props.deps)
  return <GlassContext.Provider value={{ texture }}>{props.children}</GlassContext.Provider>
}
