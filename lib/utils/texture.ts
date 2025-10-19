import html2canvas from "html2canvas-pro"
import { CanvasTexture } from "three"

export async function getTexture(element: HTMLElement): Promise<CanvasTexture> {
  const canvas = await html2canvas(element, {
    allowTaint: true,
    useCORS: true,
    logging: false,
    imageTimeout: 2000,
    scale: 1,
    x: window.scrollX,
    y: window.scrollY,

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
  return new CanvasTexture(canvas)
}
