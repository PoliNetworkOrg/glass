import { useCallback, useEffect, useMemo, useState } from "react"
import { GlassContext } from "./context"
import { setScrollKeepalive } from "./utils/frames"
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
  /**
   * Keeps a scroll-driven animation running on the page (of a transparent colour, on an element of a pixel) while the
   * 3D glass draws, on touch devices. Safari on iOS then tells the page where it is scrolled and where a finger is more
   * often (in one measure on an iPhone during a flick, from 51 to 72 scroll positions and from 60 to 95 touch moves a second),
   * which the glass follows the page with. Default: true
   */
  scrollKeepalive?: boolean
  /**
   * Draws the 3D glass in a worker, on every 120th of a second while the page moves, where the browser
   * can hand a canvas to a worker. Safari on iOS draws the page's frames 60 times a second, by default, on a display
   * that draws 120 while a finger scrolls, so glass that stays in place on the screen moves over the page every other
   * frame there; a canvas drawn in a worker is shown without waiting for the page's frames. Where the browser can't, the
   * glass is drawn on the page. Default: true
   */
  worker?: boolean
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
  const scrollKeepalive = props.scrollKeepalive ?? true
  useEffect(() => {
    setScrollKeepalive(scrollKeepalive)
    return () => setScrollKeepalive(true)
  }, [scrollKeepalive])
  const worker = props.worker ?? true
  const value = useMemo(
    () => ({ snapshot, enabled, want, scrollLead, worker }),
    [snapshot, enabled, want, scrollLead, worker]
  )
  return <GlassContext.Provider value={value}>{props.children}</GlassContext.Provider>
}
