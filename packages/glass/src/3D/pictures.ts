import { frameScroll } from "../utils/frames"
import { onMediaChange, snapshotElement } from "../utils/snapshot"
import { OVERLAY_MARGIN } from "./renderer"

// The pictures of what each glass has over its glass (its tint, its edges, its content), which the glass of a higher
// layer draws under itself. They are taken on the page's thread, which has the elements, whichever thread draws.

/**
 * The pictures wait while the page scrolls faster than this, in px per ms, and for `CALM` ms after: each one lays out and
 * paints a copy of the element with all of the page's CSS on the main thread, and during a flick the header and tab bar
 * ran into a new caption bar every 50ms or so, which made frames late and a megabyte a second of garbage. Until its
 * picture is taken, a glass shows under a higher layer without what it has over its glass, for as long as it moves too
 * fast to read.
 */
const CAPTURE_SPEED = 0.5
const CALM = 100

type Watch = {
  element: HTMLElement
  /** It changed since its picture was taken, or none was */
  stale: boolean
  capturing: boolean
  deliver: (canvas: HTMLCanvasElement) => void
  disconnect: () => void
}

const watches = new Map<object, Watch>()
/** One picture is taken at a time */
let busy = false
let now = 0
let fastAt = Number.NEGATIVE_INFINITY
let mediaWatched = false

/** Called on every frame, so the pictures know whether the page moves too fast to take one */
export function tickPictures(time: number) {
  now = time
  if (frameScroll.speed > CAPTURE_SPEED) fastAt = time
}

/**
 * Watches `element` for `key`, the first time it is called for it, and takes its picture now if it changed since the
 * last one (or there was none) and the page is calm: `deliver` gets each picture. The press of a glass moves and lights
 * its element through its own style, and its canvas is redrawn on every frame, so neither counts as a change.
 */
export function takePicture(key: object, element: HTMLElement, deliver: (canvas: HTMLCanvasElement) => void) {
  let watch = watches.get(key)
  if (!watch) {
    if (!mediaWatched) {
      mediaWatched = true
      // the pictures look different when a media query of the page changes (the device's theme)
      onMediaChange(() => {
        for (const w of watches.values()) w.stale = true
      })
    }
    const created: Watch = { element, stale: true, capturing: false, deliver, disconnect: () => {} }
    const mutations = new MutationObserver((records) => {
      const own = (r: MutationRecord) =>
        r.type === "attributes" && (r.target === element || r.target instanceof HTMLCanvasElement)
      if (records.some((r) => !own(r))) created.stale = true
    })
    mutations.observe(element, { subtree: true, childList: true, attributes: true, characterData: true })
    // it reports the size it starts with too, which the picture about to be taken already has
    let size: string = ""
    const resizes = new ResizeObserver(([entry]) => {
      const next = `${entry.contentRect.width}x${entry.contentRect.height}`
      if (size && next !== size) created.stale = true
      size = next
    })
    resizes.observe(element)
    created.disconnect = () => {
      mutations.disconnect()
      resizes.disconnect()
    }
    watches.set(key, created)
    watch = created
  }
  watch.deliver = deliver
  if (!watch.stale || watch.capturing || busy || now - fastAt < CALM) return
  const w = watch
  w.capturing = true
  w.stale = false
  busy = true
  snapshotElement(w.element, OVERLAY_MARGIN)
    .then(({ canvas, fresh }) => {
      if (watches.get(key) !== w) return
      w.deliver(canvas)
      // taken again a moment later, in case WebKit drew it before decoding the images that are new in it
      if (fresh) {
        setTimeout(() => {
          w.stale = true
        }, 400)
      }
    })
    .catch(() => {
      /* the element couldn't be drawn: the glass is shown without what it has over it */
    })
    .finally(() => {
      w.capturing = false
      busy = false
    })
}

/** Stops watching the element of `key` */
export function forgetPicture(key: object) {
  watches.get(key)?.disconnect()
  watches.delete(key)
}
