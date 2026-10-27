import { createContext, useContext } from "react"
import type { Texture } from "three"

type GlassContextType = {
  texture: Texture | null
  /** false when the glass is turned off for the whole tree */
  enabled: boolean
}

export const GlassContext = createContext<GlassContextType>({
  texture: null,
  enabled: true,
})

export function useGlass() {
  return useContext(GlassContext)
}

/** Whether the glass is inside another glass */
export const GlassNestContext = createContext(false)
