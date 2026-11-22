import type { GlassUniforms } from "./displacement"

// What the page and the worker that draws the glass tell each other. Times are on the clock both share,
// `performance.timeOrigin + performance.now()`, in ms.

/** The state of a glass as the page reads it on one of its frames: where it is, not ahead */
export type SentState = {
  /** The id of the picture of the page it bends */
  snapshot: number
  layer: number
  order: number
  width: number
  height: number
  drawn: [number, number]
  /** Where its center is on the page, as read */
  center: [number, number]
  /** Where the page was scrolled when it was read */
  scroll: [number, number]
  /** When it was read */
  t: number
  lead: number
  saturate: number
  lift: number
  uniforms: GlassUniforms
}

export type ToWorker =
  /** A glass, and the canvas it is shown on, handed over */
  | { type: "add"; id: number; canvas: OffscreenCanvas }
  | { type: "remove"; id: number }
  /** Its state, when it changed, or null when it has no size */
  | { type: "state"; id: number; state: SentState | null }
  /** Where the page was scrolled at `t` */
  | { type: "scroll"; t: number; x: number; y: number }
  /** When a frame of the page started: the display draws on the 120ths of a second from there */
  | { type: "vsync"; t: number }
  /** A picture of the page, flipped for the GPU, of a page `width` x `height` */
  | { type: "snapshot"; id: number; bitmap: ImageBitmap; width: number; height: number }
  | { type: "release"; id: number }
  /** The picture of what glass `id` has over its glass, flipped and premultiplied */
  | { type: "overlay"; id: number; bitmap: ImageBitmap }

export type FromWorker =
  /** Glass `id` is under a higher layer: send the picture of what it has over its glass, and again when it changes */
  | { type: "overlay"; id: number }
  /** The worker can't draw (no WebGL2 in a worker) */
  | { type: "failed"; reason: string }
