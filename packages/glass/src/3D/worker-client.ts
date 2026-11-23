import { drawFrames, frameScroll } from "../utils/frames"
import type { Renderer } from "./main"
import { forgetPicture, takePicture, tickPictures } from "./pictures"
import { type FromWorker, STILL_PX, type ToWorker } from "./protocol"
import type { GlassState, GlassTarget, Picture } from "./renderer"
import GlassWorker from "./worker?worker&inline"

// The page's side of the renderer in a worker (worker.ts): it reads what only the page can, on its frames, and sends
// what changed. The state of each glass when it changes; where the page is scrolled, on every frame and, while it moves,
// from a loop that reads it every few ms between them, which hears of the scroll more often than the frames do on iOS
// (51 positions a second against 33, measured in the Frame lab of the demo, more with the scroll keepalive); the
// pictures of the page and of the elements, as bitmaps.

/** How often the loop between the frames reads the scroll while the page moves, in ms */
const TIGHT = 4
/** How long the loop goes on after the scroll last moved, in ms */
const TIGHT_FOR = 300
/** Every how many frames of the page the worker is told when one started, to keep its own in step */
const VSYNC_EVERY = 30
/** A lead that changed by less than this, in ms, isn't sent: the measured frame is a little different on every one */
const LEAD_STEP = 1

const clock = () => performance.timeOrigin + performance.now()

/** Whether this browser can hand a canvas to a worker, and send it pictures */
export function workerSupported() {
  return (
    typeof Worker === "function" &&
    typeof OffscreenCanvas === "function" &&
    typeof createImageBitmap === "function" &&
    typeof HTMLCanvasElement !== "undefined" &&
    "transferControlToOffscreen" in HTMLCanvasElement.prototype
  )
}

type Sent = {
  id: number
  /** The key of the state last sent, -1 for none */
  key: number
  /** The lead of the state last sent */
  lead: number
  /** Where its center and the scroll were in the state last sent: NaN for none */
  center: [number, number]
  scroll: [number, number]
  /**
   * The worker draws it where the scroll or its own path goes, not in place on the page: what the worker made of the
   * states sent (see `receive` in worker.ts), followed here as it does, so that one state with the page scrolled and the
   * center still tells it the glass stopped
   */
  moving: boolean
  /** A state was sent: the first one says, from `fixed`, how the worker draws it until it moves */
  known: boolean
  nulled: boolean
  order: number
  /** The worker asked for the picture of what it has over its glass */
  overlay: boolean
  /** It is in a box fixed to the screen: null until its element is there to ask */
  fixed: boolean | null
}

/** Whether `element` is in a box fixed to the screen, which keeps it in place there while the page scrolls */
function inFixedBox(element: HTMLElement) {
  for (let node: Element | null = element; node && node !== document.body; node = node.parentElement) {
    if (getComputedStyle(node).position === "fixed") return true
  }
  return false
}

class WorkerRenderer implements Renderer {
  private readonly worker: Worker
  private readonly glasses = new Map<GlassTarget, Sent>()
  private readonly byId = new Map<number, GlassTarget>()
  private readonly pictureIds = new WeakMap<Picture, number>()
  private ids = 0
  private frames = 0
  private stop: (() => void) | null = null
  private reorder = true
  private readonly last = { x: Number.NaN, y: Number.NaN }
  /** The states of this frame, one list kept from frame to frame */
  private readonly states: (GlassState | null)[] = []

  constructor() {
    this.worker = new GlassWorker()
    this.worker.onmessage = ({ data }: MessageEvent<FromWorker>) => {
      if (data.type === "drew") {
        drewCounts[drewNext] = data.count
        drewTimes[drewNext] = data.t
        drewNext = (drewNext + 1) % DREW_KEPT
      } else if (data.type === "overlay") {
        const target = this.byId.get(data.id)
        const sent = target && this.glasses.get(target)
        if (sent) sent.overlay = true
      } else {
        console.warn(`glass: the worker can't draw, the glass is drawn on the page: ${data.reason}`)
        this.fail()
      }
    }
    // what it can't say itself: its script didn't load (blocked by the page's CSP), or threw outside what it catches
    this.worker.onerror = (e) => {
      e.preventDefault()
      console.warn(`glass: the worker stopped, the glass is drawn on the page: ${e.message}`)
      this.fail()
    }
  }

  /** Gives up on the worker: the glass is drawn on the page's thread from the next render (see `useRenderer`) */
  private fail() {
    this.worker.terminate()
    this.stop?.()
    this.stop = null
    failure.failed = true
    for (const listener of failure.listeners) listener()
  }

  private post(message: ToWorker, transfer: Transferable[] = []) {
    this.worker.postMessage(message, transfer)
  }

  add(target: GlassTarget) {
    const canvas = target.canvas as HTMLCanvasElement
    const offscreen = canvas.transferControlToOffscreen()
    const id = ++this.ids
    this.glasses.set(target, {
      id,
      key: -1,
      lead: 0,
      center: [Number.NaN, Number.NaN],
      scroll: [0, 0],
      moving: false,
      known: false,
      nulled: false,
      order: 0,
      overlay: false,
      fixed: null,
    })
    this.byId.set(id, target)
    this.reorder = true
    this.post({ type: "add", id, canvas: offscreen }, [offscreen])
    if (!this.stop) {
      const stopFrames = drawFrames((time) => this.tick(time))
      const stopFeed = feedScroll((t, x, y) => this.sample(t, x, y))
      this.stop = () => {
        stopFrames()
        stopFeed()
      }
    }
    return () => {
      this.glasses.delete(target)
      this.byId.delete(id)
      forgetPicture(target)
      this.post({ type: "remove", id })
      if (this.glasses.size === 0) {
        this.stop?.()
        this.stop = null
        this.states.length = 0
      }
    }
  }

  release(snapshot: Picture) {
    const id = this.pictureIds.get(snapshot)
    if (id === undefined) return
    this.pictureIds.delete(snapshot)
    this.post({ type: "release", id })
  }

  /** Sends where the page is scrolled, if it moved: says whether it did */
  private sample(t: number, x: number, y: number) {
    if (x === this.last.x && y === this.last.y) return false
    this.last.x = x
    this.last.y = y
    this.post({ type: "scroll", t, x, y })
    return true
  }

  /** The id of a picture of the page in the worker, sent the first time it is asked for */
  private picture(snapshot: Picture) {
    let id = this.pictureIds.get(snapshot)
    if (id !== undefined) return id
    id = ++this.ids
    const sent = id
    this.pictureIds.set(snapshot, id)
    // taken now, before the canvas can be freed; flipped here, as a bitmap isn't by the GPU
    createImageBitmap(snapshot.canvas, { imageOrientation: "flipY", premultiplyAlpha: "none" })
      .then((bitmap) => {
        // released while it was made: the worker, which didn't have it, let the release go, and would keep it forever
        if (this.pictureIds.get(snapshot) !== sent) {
          bitmap.close()
          return
        }
        this.post({ type: "snapshot", id: sent, bitmap, width: snapshot.width, height: snapshot.height }, [bitmap])
      })
      .catch(() => {
        /* the canvas was freed first: a newer picture takes its place */
      })
    return id
  }

  private tick(time: number) {
    tickPictures(time)
    if (this.frames++ % VSYNC_EVERY === 0) this.post({ type: "vsync", t: performance.timeOrigin + time })
    const t = clock()
    this.sample(t, frameScroll.x, frameScroll.y)

    const states = this.states
    states.length = 0
    for (const target of this.glasses.keys()) states.push(target.frame(time))
    if (this.reorder) {
      // where each is in the document, which decides which of two on a layer is drawn over the other
      const ordered: [Sent, HTMLElement][] = []
      let i = 0
      for (const sent of this.glasses.values()) {
        const element = states[i++]?.element
        if (element) ordered.push([sent, element])
      }
      ordered.sort(([, a], [, b]) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      ordered.forEach(([sent], n) => {
        sent.order = n
        sent.key = -1
      })
      this.reorder = ordered.length < this.glasses.size
    }

    let i = 0
    for (const [target, sent] of this.glasses) {
      const state = states[i++]
      if (!state) {
        if (!sent.nulled) this.post({ type: "state", id: sent.id, state: null })
        sent.nulled = true
        sent.key = -1
        // the worker compares the next state with none, and learns nothing from it: it keeps drawing it as it did
        sent.center[0] = sent.center[1] = Number.NaN
        continue
      }
      sent.nulled = false
      // asked once: the worker learns it from how the glass moves too, but only after the page has scrolled
      if (sent.fixed === null && state.element) sent.fixed = inFixedBox(state.element)
      if (sent.overlay && state.element) {
        takePicture(target, state.element, (canvas) => {
          createImageBitmap(canvas, { imageOrientation: "flipY", premultiplyAlpha: "premultiply" })
            .then((bitmap) => this.post({ type: "overlay", id: sent.id, bitmap }, [bitmap]))
            .catch(() => {})
        })
      }
      const sx = frameScroll.x
      const sy = frameScroll.y
      if (state.key === sent.key) {
        // The same state, but still sent when the worker draws it from the old one wrong: the lead it is drawn ahead
        // with changed (from touch to a mouse, a new `scrollLead`); or it followed the screen and stopped (a sticky
        // glass at the end of its box) while the page goes on scrolling, which only a state with the page scrolled
        // and the center still tells the worker. Not on every scroll: most glasses scroll with the page, center still.
        const leadChanged = Math.abs(state.lead - sent.lead) >= LEAD_STEP
        const stopped = sent.moving && Math.hypot(sx - sent.scroll[0], sy - sent.scroll[1]) >= STILL_PX
        if (!leadChanged && !stopped) continue
      }
      sent.key = state.key
      sent.lead = state.lead
      if (!sent.known) {
        sent.known = true
        sent.moving = sent.fixed ?? false
      } else if (!Number.isNaN(sent.center[0])) {
        // only what changes what the worker does changes this: a state with nothing moved (a new picture, a new tint
        // with the page still) leaves it drawing the glass as it did, and this saying so
        const centerMoved = Math.hypot(state.center[0] - sent.center[0], state.center[1] - sent.center[1]) >= STILL_PX
        const scrolled = Math.hypot(sx - sent.scroll[0], sy - sent.scroll[1]) >= STILL_PX
        if (scrolled && !centerMoved) sent.moving = false
        else if (centerMoved) sent.moving = true
      }
      sent.center[0] = state.center[0]
      sent.center[1] = state.center[1]
      sent.scroll[0] = sx
      sent.scroll[1] = sy
      this.post({
        type: "state",
        id: sent.id,
        state: {
          snapshot: this.picture(state.snapshot),
          layer: state.layer,
          order: sent.order,
          width: state.width,
          height: state.height,
          drawn: state.drawn,
          center: state.center,
          scroll: [sx, sy],
          t,
          fixed: sent.fixed ?? false,
          lead: state.lead,
          saturate: state.saturate,
          lift: state.lift,
          uniforms: state.uniforms,
        },
      })
    }
  }
}

/**
 * Reads where the page is scrolled between its frames, while it moves or a finger is on it: on a scroll event, and in a
 * loop of a message, for a task of its own, then a timer, every {@link TIGHT} ms. `sample` says whether it moved.
 */
function feedScroll(sample: (t: number, x: number, y: number) => boolean) {
  const channel = new MessageChannel()
  const loop = { running: false, until: 0, touching: false }
  const read = () => sample(clock(), window.scrollX, window.scrollY)
  const post = () => channel.port2.postMessage(0)
  channel.port1.onmessage = () => {
    const now = performance.now()
    if (read()) loop.until = now + TIGHT_FOR
    if (loop.touching || now < loop.until) setTimeout(post, TIGHT)
    else loop.running = false
  }
  const kick = () => {
    loop.until = performance.now() + TIGHT_FOR
    if (!loop.running) {
      loop.running = true
      post()
    }
  }
  const onScroll = () => {
    read()
    kick()
  }
  const onTouchStart = () => {
    loop.touching = true
    kick()
  }
  const onTouchEnd = (e: TouchEvent) => {
    loop.touching = e.touches.length > 0
  }
  const opts = { passive: true, capture: true }
  window.addEventListener("scroll", onScroll, opts)
  window.addEventListener("touchstart", onTouchStart, opts)
  window.addEventListener("touchend", onTouchEnd, opts)
  window.addEventListener("touchcancel", onTouchEnd, opts)
  return () => {
    loop.touching = false
    loop.until = 0
    channel.port1.close()
    window.removeEventListener("scroll", onScroll, opts)
    window.removeEventListener("touchstart", onTouchStart, opts)
    window.removeEventListener("touchend", onTouchEnd, opts)
    window.removeEventListener("touchcancel", onTouchEnd, opts)
  }
}

let client: WorkerRenderer | null | undefined

/** The last reports of the frames the worker drew, in a ring */
const DREW_KEPT = 16
const drewCounts = new Float64Array(DREW_KEPT)
const drewTimes = new Float64Array(DREW_KEPT)
let drewNext = 0

/**
 * How many frames a second the worker drew the glass over the last second, or null when no glass is drawn in a worker.
 * Experimental, for measuring: the page's own frames are held to 60 on iOS, which a counter of them would show, while
 * the worker draws on 120 a second.
 */
export function getWorkerDrawRate(): number | null {
  if (!client || failure.failed) return null
  const since = clock() - 1000
  let count = 0
  for (let i = 0; i < DREW_KEPT; i++) if (drewTimes[i] > since) count += drewCounts[i]
  return count
}
/** The worker said it can't draw (no WebGL2 there): known only once it started */
const failure = { failed: false, listeners: new Set<() => void>() }

export function subscribeWorkerFailure(listener: () => void) {
  failure.listeners.add(listener)
  return () => {
    failure.listeners.delete(listener)
  }
}

export const workerFailed = () => failure.failed

/** The renderer in a worker, made the first time it is asked for with `create`: null where the browser can't */
export function getWorkerRenderer(create = true): Renderer | null {
  if (failure.failed) return null
  if (client === undefined) {
    if (!create) return null
    try {
      client = workerSupported() ? new WorkerRenderer() : null
    } catch {
      client = null
    }
  }
  return client
}
