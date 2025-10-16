import html2canvas from "html2canvas-pro"
import { useEffect, useState } from "react"
import { CanvasTexture, ClampToEdgeWrapping, Texture } from "three"

export async function getTexture(element: HTMLElement) {
  const canvas = await html2canvas(element, {
    ignoreElements: (el) => el.hasAttribute("glass-ignore") || el.tagName === "CANVAS",
  })
  return new CanvasTexture(canvas, Texture.DEFAULT_MAPPING, ClampToEdgeWrapping, ClampToEdgeWrapping)
}

/**
 * React hook to handle async initializers
 * @param asyncfn Async initializer function, this only gets called once
 * @returns null while the promise is not yet resolved (or has rejected), and T once fullfilled
 */
export function useAwait<T>(asyncfn: () => Promise<T>): T | null {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    void asyncfn()
      .then(setData)
      .catch(() => setData(null))
  }, [])
  return data
}
