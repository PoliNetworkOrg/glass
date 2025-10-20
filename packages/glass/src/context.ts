import { createContext, useContext } from "react"
import type { Texture } from "three"

type GlassContextType = {
  texture: Texture | null
}

export const GlassContext = createContext<GlassContextType>({
  texture: null,
})

export function useGlass() {
  return useContext(GlassContext)
}
