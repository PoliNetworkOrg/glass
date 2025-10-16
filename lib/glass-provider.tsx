import { GlassContext } from "./context"
import { getTexture, useAwait } from "./utils/hooks"

export type GlassProviderProps = {
  children: React.ReactNode
}

export function GlassProvider(props: GlassProviderProps) {
  const texture = useAwait(() => getTexture(document.body))
  return <GlassContext.Provider value={{ texture }}>{props.children}</GlassContext.Provider>
}
