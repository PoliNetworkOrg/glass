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
  /** It is in a box fixed to the screen, so it stays in place there while the page scrolls */
  fixed: boolean
  lead: number
  saturate: number
  lift: number
  uniforms: GlassUniforms
}

/** An animated layer of the page as the page read it, all of `LiveLayer` but its picture, which is sent on its own */
export type SentLayer = {
  id: number
  version: number
  width: number
  height: number
  center: [number, number]
  fixed: boolean
  matrix: [number, number, number, number]
  opacity: number
  visible: boolean
  live: boolean
}

/** Where a live layer (a canvas) was when its picture was taken, sent with it: see `live` of `LiveLayer` */
export type LayerPlace = Pick<SentLayer, "width" | "height" | "center" | "fixed" | "matrix">

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
  /**
   * A picture of the page, flipped for the GPU, of a page `width` x `height`, and what it has in front of its animated
   * layers where it has some (see `over` of the snapshot)
   */
  | { type: "snapshot"; id: number; bitmap: ImageBitmap; over: ImageBitmap | null; width: number; height: number }
  | { type: "release"; id: number }
  /** The picture of what glass `id` has over its glass, flipped and premultiplied */
  | { type: "overlay"; id: number; bitmap: ImageBitmap }
  /** The animated layers of the page, all of them, in the order of the document: when which they are or one changed */
  | { type: "layers"; layers: SentLayer[] }
  /** The picture of layer `id`, flipped and premultiplied, `margin` px bigger than its box on each side */
  | { type: "layer-picture"; id: number; bitmap: ImageBitmap; margin: number; place?: LayerPlace }

export type FromWorker =
  /** Glass `id` is under a higher layer: send the picture of what it has over its glass, and again when it changes */
  | { type: "overlay"; id: number }
  /** It drew `count` frames since its last report, up to `t` (a few times a second while it draws) */
  | { type: "drew"; count: number; t: number }
  /** The worker can't draw (no WebGL2 in a worker) */
  | { type: "failed"; reason: string }
