import { useEffect, useLayoutEffect, useState } from "react"
import type { Texture } from "three"
import { getTexture } from "./texture"

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

export function useBackgroundTexture(deps: unknown[] = []) {
  const [texture, setTexture] = useState<Texture | null>(null)

  useEffect(() => {
    const updateTexture = async () => {
      const tex = await getTexture(document.documentElement)
      setTexture(tex)
    }
    void updateTexture()
    window.addEventListener("resize", updateTexture)
    return () => {
      window.removeEventListener("resize", updateTexture)
    }
  }, deps)

  return texture
}

export function useDocumentSize() {
  const dom = document.documentElement
  const [size, setSize] = useState({
    width: dom.scrollWidth,
    height: dom.scrollHeight,
  })

  useLayoutEffect(() => {
    function onResize() {
      setSize({ width: dom.scrollWidth, height: dom.scrollHeight })
    }
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
    }
  }, [])

  return size
}
