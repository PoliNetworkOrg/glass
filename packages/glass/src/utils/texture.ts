import { CanvasTexture, type Texture } from "three"
import { snapshot } from "./snapshot"

/**
 * Takes a picture of the page and makes it a Three.js texture.
 * @param blur Blur of the picture, in px
 * @returns A Three.js {@link CanvasTexture} holding a picture of the page, see {@link pageSizeOf} for its size
 */
export async function getTexture(blur: number = 0): Promise<Texture> {
  const { canvas, width, height } = await snapshot(blur)
  const texture = new CanvasTexture(canvas)
  texture.userData.page = { width, height }
  return texture
}

/**
 * The size of the page a texture shows, in CSS px. The picture itself is smaller where the page is bigger than a
 * texture can be, so this and not the size of its image is what lines it up with the page.
 */
export function pageSizeOf(texture: Texture): { width: number; height: number } {
  const page = texture.userData.page as { width: number; height: number } | undefined
  if (page) return page
  const image = texture.image as { width: number; height: number }
  return { width: image.width, height: image.height }
}
