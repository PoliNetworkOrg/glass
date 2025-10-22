import { toCanvas } from "html-to-image"
import { CanvasTexture, type Texture } from "three"

/**
 * Screenshots the given HTML element and returns a Three.js texture.
 * @param element HTML Element to screenshot
 * @returns A Three.js {@link CanvasTexture} holding a screenshot of the element
 */
export async function getTexture(element: HTMLElement, blur: number = 0): Promise<Texture> {
  // const rand = Math.random().toString(36).substring(2, 7)
  // console.time(`getTexture-${rand}`)
  const canvas = await toCanvas(element, {
    filter: (element) => element.tagName !== "CANVAS" && !element.hasAttribute?.("glass-ignore"),
    width: element.scrollWidth,
    height: element.scrollHeight,
    quality: 0.95,
    pixelRatio: 1,
    style: blur ? { filter: `blur(${blur}px)` } : undefined,
  })
  // console.timeEnd(`getTexture-${rand}`)
  return new CanvasTexture(canvas)
}
