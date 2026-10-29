import { useCallback, useMemo, useState } from "react"
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
 * Handles fetching and updating the background texture based on the provided dependencies. The page is only
 * captured while a glass inside it is drawn in 3D.
 */
export function GlassProvider(props: GlassProviderProps) {
  const enabled = props.enabled ?? true
  // how many glasses want the texture right now
  const [wanted, setWanted] = useState(0)
  const want = useCallback(() => {
    setWanted((n) => n + 1)
    return () => setWanted((n) => n - 1)
  }, [])
  const texture = useBackgroundTexture(props.deps, props.blur, enabled && wanted > 0)
  const value = useMemo(() => ({ texture, enabled, want }), [texture, enabled, want])
  return <GlassContext.Provider value={value}>{props.children}</GlassContext.Provider>
}
