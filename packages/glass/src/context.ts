import { createContext, useContext } from "react"
import type { Texture } from "three"

type GlassContextType = {
  texture: Texture | null
  /** false when the glass is turned off for the whole tree */
  enabled: boolean
  /**
   * Says that a glass wants the texture, until the function it returns is called. The page is only captured while
   * one does, so a tree whose glass is all CSS (a slow device, reduced motion, nothing on screen) never pays for it.
   */
  want: () => () => void
}

export const GlassContext = createContext<GlassContextType>({
  texture: null,
  enabled: true,
  want: () => () => {},
})

export function useGlass() {
  return useContext(GlassContext)
}

/** Whether the glass is inside another glass */
export const GlassNestContext = createContext(false)
