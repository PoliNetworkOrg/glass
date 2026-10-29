import { useCallback, useMemo, useState } from "react"
import { GlassContext } from "./context"
import { usePageSnapshot } from "./utils/hooks"

export type GlassProviderProps = {
  children: React.ReactNode
  /** Dependency array for the picture of the page, changes will capture it again */
  deps?: unknown[]
  /** Blur amount for the picture of the page */
  blur?: number
  /** Turns the 3D glass off for the whole tree, and stops capturing the background. Default: true */
  enabled?: boolean
  /**
   * How far ahead, in ms, the 3D glass draws the page while the page moves under it. The browser tells the page that
   * it scrolled a frame or more after it did, so the glass draws the page behind where it is: it makes up for that by
   * drawing it where it is going, at the speed it is moving. 0 draws it where it was. Default: 16, which is the frame
   * Chrome is late by (measured: 41px behind during a 2500px/s scroll without it, about 1px with it)
   */
  scrollLead?: number
}

/**
 * # GlassProvider
 * Provides the picture of the page to all glass components within its tree.
 *
 * Handles capturing and updating the picture based on the provided dependencies. The page is only
 * captured while a glass inside it is drawn in 3D.
 */
export function GlassProvider(props: GlassProviderProps) {
  const enabled = props.enabled ?? true
  // how many glasses want the picture right now
  const [wanted, setWanted] = useState(0)
  const want = useCallback(() => {
    setWanted((n) => n + 1)
    return () => setWanted((n) => n - 1)
  }, [])
  const snapshot = usePageSnapshot(props.deps, props.blur, enabled && wanted > 0)
  const scrollLead = props.scrollLead ?? 16
  const value = useMemo(() => ({ snapshot, enabled, want, scrollLead }), [snapshot, enabled, want, scrollLead])
  return <GlassContext.Provider value={value}>{props.children}</GlassContext.Provider>
}
