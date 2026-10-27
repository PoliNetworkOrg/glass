import { GlassContext } from "./context"
import { useBackgroundTexture } from "./utils/hooks"

export type GlassProviderProps = {
  children: React.ReactNode
  /** Dependency array for the background texture, changes will trigger a re-fetch */
  deps?: unknown[]
  /** Blur amount for the background texture */
  blur?: number
  /** Turns the 3D glass off for the whole tree, and stops capturing the background. Default: true */
  enabled?: boolean
}

/**
 * # GlassProvider
 * Provides the background texture to all glass components within its tree.
 *
 * Handles fetching and updating the background texture based on the provided dependencies.
 */
export function GlassProvider(props: GlassProviderProps) {
  const enabled = props.enabled ?? true
  const texture = useBackgroundTexture(props.deps, props.blur, enabled)
  return <GlassContext.Provider value={{ texture, enabled }}>{props.children}</GlassContext.Provider>
}
