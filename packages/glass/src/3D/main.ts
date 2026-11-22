import { useMemo, useSyncExternalStore } from "react"
import { drawFrames, frameScroll } from "../utils/frames"
import { createPredictor } from "../utils/predict"
import type { Snapshot } from "../utils/snapshot"
import { liveLayers, watchLayers } from "./layers"
import { forgetPicture, takePicture, tickPictures } from "./pictures"
import { GlassRenderer, type GlassTarget, type Picture } from "./renderer"
import { getWorkerRenderer, subscribeWorkerFailure, workerFailed } from "./worker-client"

// The renderer on the page's thread: it draws on the page's animation frames, at the scroll they read.

/** What a glass is drawn by: the renderer on this thread, or the one in a worker */
export type Renderer = {
  /** Draws `target` on every frame, until the function it returns is called */
  add: (target: GlassTarget) => () => void
  /** Frees the copies of a picture of the page that is no longer drawn */
  release: (snapshot: Picture) => void
}

/** Where the page is scrolled, ahead by the lead as the glass is */
const scroll = createPredictor()

/** The renderer, made the first time it is asked for: null where the device has no WebGL2 */
let renderer: GlassRenderer | null | undefined

export function getRenderer(): Renderer | null {
  if (renderer === undefined) {
    try {
      renderer =
        typeof document === "undefined"
          ? null
          : new GlassRenderer({
              // the layers are read in the read phase of the same frames, before they are drawn
              frames: (draw) => {
                const stopLayers = watchLayers()
                const stopDrawing = drawFrames(draw)
                return () => {
                  stopDrawing()
                  stopLayers()
                }
              },
              layers: () => liveLayers,
              tick: tickPictures,
              scroll: (time, lead) => scroll(time, frameScroll.x, frameScroll.y, lead),
              overlay: (target, state, overlay) => {
                if (!state.element) return
                overlay.dispose = () => forgetPicture(target)
                takePicture(target, state.element, ({ canvas }) => {
                  overlay.canvas = canvas
                  overlay.uploaded = false
                  overlay.version++
                })
              },
            })
    } catch {
      renderer = null
    }
  }
  return renderer
}

/**
 * Frees a picture of the page, once nothing draws it anymore: its copies on the GPU, here and in the worker, and its
 * canvas, which is as big as the page and which iOS counts against a cap on the memory of all the canvases of the page
 * until it is collected.
 */
export function releaseSnapshot(snapshot: Snapshot) {
  renderer?.release(snapshot)
  getWorkerRenderer(false)?.release(snapshot)
  snapshot.canvas.width = 0
  snapshot.canvas.height = 0
  if (snapshot.over) {
    snapshot.over.width = 0
    snapshot.over.height = 0
  }
}

/**
 * The renderer of the glass, and whether it is the one in a worker: that one where `worker` asks for it and the browser
 * can hand it a canvas, until it says it can't draw, then the one on this thread. The worker is asked rather than a
 * WebGL2 context made here to find out, which would be a second renderer on the page, compiled for nothing.
 */
export function useRenderer(worker: boolean): readonly [Renderer | null, boolean] {
  const failed = useSyncExternalStore(subscribeWorkerFailure, workerFailed, () => false)
  return useMemo(() => {
    const off = worker && !failed ? getWorkerRenderer() : null
    return off ? ([off, true] as const) : ([getRenderer(), false] as const)
  }, [worker, failed])
}
