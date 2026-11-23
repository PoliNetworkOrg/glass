import { drawFrames, frameScroll } from "../utils/frames"
import { inFixedBox, liveLayers, watchLayers } from "./layers"
import type { Renderer } from "./main"
import { forgetPicture, takePicture, tickPictures } from "./pictures"
import type { FromWorker, ToWorker } from "./protocol"
import { type GlassState, type GlassTarget, type LiveLayer, layerHalf, type Picture } from "./renderer"
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
/**
 * How close to a glass a live layer (a canvas) has to be for its picture to be sent, in px: it is taken on every frame,
 * and only what is behind a glass, or about to be, as far as its frost reads, needs it
 */
const LIVE_NEAR = 256

/**
 * What the worker needs to be told again about a layer when it changes: its version, or for a live layer, which is
 * moved by its pictures, only whether it shows and how much
 */
const layerKey = (layer: LiveLayer) => (layer.live ? `${layer.visible} ${layer.opacity}` : layer.version)

/** Whether `layer` is near enough a glass of this frame for the glass to draw it: see {@link LIVE_NEAR} */
function nearGlass(layer: LiveLayer, states: (GlassState | null)[]) {
  const x = layer.center[0] + (layer.fixed ? frameScroll.x : 0)
  const y = layer.center[1] + (layer.fixed ? frameScroll.y : 0)
  const hw = layerHalf(layer, 0) + LIVE_NEAR
  const hh = layerHalf(layer, 1) + LIVE_NEAR
  for (const state of states) {
    if (!state) continue
    if (
      Math.abs(state.center[0] - x) < hw + state.drawn[0] / 2 &&
      Math.abs(state.center[1] - y) < hh + state.drawn[1] / 2
    )
      return true
  }
  return false
}

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
  nulled: boolean
  order: number
  /** The worker asked for the picture of what it has over its glass */
  overlay: boolean
  /** It is in a box fixed to the screen: null until its element is there to ask */
  fixed: boolean | null
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
  /** What the worker was last told of the animated layers: which they were, each one's version and picture */
  private layersSet = -1
  private readonly layerVersions = new Map<number, number | string>()
  private readonly layerPictures = new Map<number, number>()
  /** Live layers whose picture is on its way to the worker: one at a time each, the next one is taken once it is */
  private readonly layerSending = new Set<number>()

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
    this.glasses.set(target, { id, key: -1, nulled: false, order: 0, overlay: false, fixed: null })
    this.byId.set(id, target)
    this.reorder = true
    this.post({ type: "add", id, canvas: offscreen }, [offscreen])
    if (!this.stop) {
      const stopLayers = watchLayers()
      const stopFrames = drawFrames((time) => this.tick(time))
      const stopFeed = feedScroll((t, x, y) => this.sample(t, x, y))
      this.stop = () => {
        stopFrames()
        stopFeed()
        stopLayers()
        this.layersSet = -1
        this.layerVersions.clear()
        this.layerPictures.clear()
        this.layerSending.clear()
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
    const flipped = (canvas: HTMLCanvasElement | ImageBitmap) =>
      createImageBitmap(canvas, { imageOrientation: "flipY", premultiplyAlpha: "none" })
    Promise.all([flipped(snapshot.canvas), snapshot.over ? flipped(snapshot.over) : null])
      .then(([bitmap, over]) =>
        this.post({ type: "snapshot", id: sent, bitmap, over, width: snapshot.width, height: snapshot.height }, [
          bitmap,
          ...(over ? [over] : []),
        ])
      )
      .catch(() => {
        /* the canvas was freed first: a newer picture takes its place */
      })
    return id
  }

  /** Tells the worker of the animated layers, when which they are or one of them changed, and sends new pictures */
  private sendLayers(states: (GlassState | null)[]) {
    const { list, set } = liveLayers
    let changed = set !== this.layersSet
    for (const layer of list) {
      if (this.layerVersions.get(layer.id) !== layerKey(layer)) changed = true
      const picture = layer.picture
      if (!picture || this.layerPictures.get(layer.id) === layer.pictureVersion) continue
      if (layer.live) {
        if (layer.visible && !this.layerSending.has(layer.id) && nearGlass(layer, states)) this.sendLive(layer, picture)
        continue
      }
      this.layerPictures.set(layer.id, layer.pictureVersion)
      const { id, margin } = layer
      createImageBitmap(picture, { imageOrientation: "flipY", premultiplyAlpha: "premultiply" })
        .then((bitmap) => this.post({ type: "layer-picture", id, bitmap, margin }, [bitmap]))
        .catch(() => {})
    }
    if (!changed) return
    if (set !== this.layersSet) {
      this.layersSet = set
      for (const id of [...this.layerVersions.keys()]) {
        if (list.some((layer) => layer.id === id)) continue
        this.layerVersions.delete(id)
        this.layerPictures.delete(id)
        this.layerSending.delete(id)
      }
    }
    for (const layer of list) this.layerVersions.set(layer.id, layerKey(layer))
    this.post({
      type: "layers",
      layers: list.map(({ id, version, width, height, center, fixed, matrix, opacity, visible, live }) => ({
        id,
        version,
        width,
        height,
        center,
        fixed,
        matrix,
        opacity,
        visible,
        live,
      })),
    })
  }

  /**
   * Sends the picture of a live layer (a canvas) as it is now, with where it is now: the page draws on it and moves it
   * on the same frame, so the worker moves it when the picture comes. At 1x, as the glass draws what is behind it, which
   * is a quarter of the pixels to copy at 2x.
   */
  private sendLive(layer: LiveLayer, picture: HTMLCanvasElement | ImageBitmap) {
    const { id } = layer
    this.layerPictures.set(id, layer.pictureVersion)
    this.layerSending.add(id)
    const place = {
      width: layer.width,
      height: layer.height,
      center: [layer.center[0], layer.center[1]] as [number, number],
      fixed: layer.fixed,
      matrix: [...layer.matrix] as [number, number, number, number],
    }
    createImageBitmap(picture, {
      imageOrientation: "flipY",
      premultiplyAlpha: "premultiply",
      resizeWidth: Math.max(1, Math.min(picture.width, Math.ceil(layer.width))),
      resizeHeight: Math.max(1, Math.min(picture.height, Math.ceil(layer.height))),
      resizeQuality: "medium",
    })
      .then((bitmap) => this.post({ type: "layer-picture", id, bitmap, margin: 0, place }, [bitmap]))
      .catch(() => {})
      .finally(() => this.layerSending.delete(id))
  }

  private tick(time: number) {
    tickPictures(time)
    if (this.frames++ % VSYNC_EVERY === 0) this.post({ type: "vsync", t: performance.timeOrigin + time })
    const t = clock()
    this.sample(t, frameScroll.x, frameScroll.y)

    const states = this.states
    states.length = 0
    for (const target of this.glasses.keys()) states.push(target.frame(time))
    this.sendLayers(states)
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
        continue
      }
      sent.nulled = false
      // asked once: the worker learns it from how the glass moves too, but only after the page has scrolled
      if (sent.fixed === null && state.element) sent.fixed = inFixedBox(state.element)
      if (sent.overlay && state.element) {
        takePicture(target, state.element, ({ canvas }) => {
          createImageBitmap(canvas, { imageOrientation: "flipY", premultiplyAlpha: "premultiply" })
            .then((bitmap) => this.post({ type: "overlay", id: sent.id, bitmap }, [bitmap]))
            .catch(() => {})
        })
      }
      if (state.key === sent.key) continue
      sent.key = state.key
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
          scroll: [frameScroll.x, frameScroll.y],
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
