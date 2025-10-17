import html2canvas from "html2canvas-pro"
import { useEffect, useLayoutEffect, useState } from "react"
import { CanvasTexture, ClampToEdgeWrapping, Texture } from "three"

export async function getTexture(element: HTMLElement) {
  const canvas = await html2canvas(element, {
    allowTaint: true,
    useCORS: true,
    logging: false,
    scale: 1,

    ignoreElements: (element) => {
      let el: Element | null = element
      while (el) {
        if (el.hasAttribute("glass-ignore") || el.tagName === "CANVAS") {
          return true
        }
        el = el.parentElement
      }
      return false
    },
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

export function useScroll(element?: HTMLElement) {
  const el = element ?? document.documentElement
  const [scroll, setScroll] = useState({ x: el.scrollLeft, y: el.scrollTop })

  useLayoutEffect(() => {
    function onScroll() {
      setScroll({ x: el.scrollLeft, y: el.scrollTop })
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      el.removeEventListener("scroll", onScroll)
    }
  }, [el])

  return scroll
}
