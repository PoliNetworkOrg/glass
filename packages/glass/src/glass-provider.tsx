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
   * it scrolled a frame after it did, so the glass draws the page a frame behind where it is: a lead draws it where it
   * is going, at the speed it is moving, and only once it moves fast (a slow scroll is drawn where the browser says).
   * Default: a frame of the display (measured) while a finger scrolls the page, and 0 while a wheel does. A flick slows
   * down smoothly, which a lead follows; a wheel stops dead, which a lead overshoots, so there the lag that holds still
   * shows less. A number sets the lead for every input, and 0 turns it off
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
  const scrollLead = props.scrollLead
  const value = useMemo(() => ({ snapshot, enabled, want, scrollLead }), [snapshot, enabled, want, scrollLead])
  return <GlassContext.Provider value={value}>{props.children}</GlassContext.Provider>
}
