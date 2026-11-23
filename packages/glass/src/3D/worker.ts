import { createStreamPredictor } from "../utils/predict"
import { type FromWorker, type SentState, STILL_PX, type ToWorker } from "./protocol"
import { GlassRenderer, type GlassState, type GlassTarget, nextKey, type Overlay, type Picture } from "./renderer"

// The renderer in a worker. Safari on iOS draws the page's animation frames 60 times a second by default, on a display
// that draws 120 while a finger moves the page, so the glass that stays in place on the screen (a header, a tab bar)
// moved over the page every other frame. A canvas handed to a worker is shown when the worker draws it, without waiting
// for the page's frames: this one draws on every 120th of a second while something moves, at where the page will be
// scrolled then, from where the page says it was (see the Frame lab of the demo).
//
// What it knows of the page is what the page sends (worker-client.ts): the state of each glass when it changes, where
// the page is scrolled as often as it can read it, the pictures. A glass whose center moved with the scroll, and stayed
// in place on the screen, is drawn where the scroll will be; one that stayed in place on the page as the page read it;
// one that moves by itself (an animation) ahead along its own path.

const PERIOD = 1000 / 120
/** How long it keeps drawing after the last news, in ms */
const AWAKE = 400
/** Every how many ms it tells the page how many frames it drew, while it draws */
const REPORT_EVERY = 250

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null
  postMessage: (message: FromWorker) => void
}
const clock = () => performance.timeOrigin + performance.now()

const scroll = createStreamPredictor()
const pictures = new Map<number, Picture>()

type Model = {
  id: number
  target: GlassTarget
  remove: () => void
  sent: SentState | null
  /** How it moves: with the screen (fixed), with the page, or by itself */
  anchor: "screen" | "page" | "own"
  /** Where it is on the screen, for one that stays there: its center from where the page is scrolled */
  offset: [number, number]
  own: ReturnType<typeof createStreamPredictor>
  /** The state it hands the renderer, one object changed in place */
  state: GlassState | null
  made: { sent: SentState | null; picture: Picture | null; cx: number; cy: number }
  overlay: Overlay | null
  asked: boolean
  /** It has had a state, so how it moves is known from what it did, more than from what the page said it is */
  known: boolean
}

const models = new Map<number, Model>()
const byTarget = new Map<GlassTarget, Model>()

// The loop: on the 120ths of a second from the last frame of the page, while something moves
let draw: ((time: number) => void) | null = null
let phase = 0
let slot = -1
let timer: ReturnType<typeof setTimeout> | null = null
let awakeUntil = 0
/** The frames drawn since the last report to the page, which the demo shows */
const drew = { count: 0, at: 0 }

function report(now: number) {
  if (drew.count === 0) return
  scope.postMessage({ type: "drew", count: drew.count, t: now })
  drew.count = 0
  drew.at = now
}

function schedule(now: number) {
  const current = Math.floor((now - phase) / PERIOD)
  timer = setTimeout(run, (current + 1) * PERIOD + phase - now)
}

function run() {
  timer = null
  const now = clock()
  const current = Math.floor((now - phase) / PERIOD)
  if (current !== slot && draw) {
    slot = current
    draw(now)
    drew.count++
  }
  if (draw && now < awakeUntil) {
    if (now - drew.at >= REPORT_EVERY) report(now)
    schedule(now)
  } else report(now)
}

function wake(ms = AWAKE) {
  const now = clock()
  awakeUntil = Math.max(awakeUntil, now + ms)
  if (!timer && draw) schedule(now)
}

let renderer: GlassRenderer | null = null
try {
  renderer = new GlassRenderer({
    frames: (d) => {
      draw = d
      wake()
      return () => {
        draw = null
        if (timer) clearTimeout(timer)
        timer = null
      }
    },
    scroll: (time, lead) => scroll.at(time, lead),
    overlay: (target, _state, overlay) => {
      const model = byTarget.get(target)
      if (!model) return
      model.overlay = overlay
      if (!model.asked) {
        model.asked = true
        scope.postMessage({ type: "overlay", id: model.id })
      }
    },
  })
} catch (e) {
  scope.postMessage({ type: "failed", reason: String(e) })
}

/** The state of a glass on a frame drawn at `time`: where it will be when it is on screen */
function frame(model: Model, time: number): GlassState | null {
  const s = model.sent
  if (!s) return null
  const picture = pictures.get(s.snapshot)
  // until the new picture of the page comes, it draws the one it had, if that one is still here
  if (!picture) {
    const had = model.made.picture
    return model.state && had && [...pictures.values()].includes(had) ? model.state : null
  }
  let cx = s.center[0]
  let cy = s.center[1]
  if (model.anchor === "screen") {
    const [sx, sy] = scroll.at(time, s.lead)
    cx = sx + model.offset[0]
    cy = sy + model.offset[1]
  } else if (model.anchor === "own") {
    ;[cx, cy] = model.own.at(time, s.lead)
  }
  const made = model.made
  if (model.state && made.sent === s && made.picture === picture && made.cx === cx && made.cy === cy) {
    return model.state
  }
  made.sent = s
  made.picture = picture
  made.cx = cx
  made.cy = cy
  const uniforms = s.uniforms
  // where the center of the page is, from the center of the glass, y up (as Glass3D works it out)
  uniforms.bg[0] = picture.width / 2 - cx
  uniforms.bg[1] = cy - picture.height / 2
  const state: GlassState = model.state ?? {
    snapshot: picture,
    layer: 0,
    element: null,
    order: 0,
    width: 0,
    height: 0,
    drawn: [0, 0],
    center: [0, 0],
    lead: 0,
    saturate: 1,
    lift: 1,
    uniforms,
    key: 0,
  }
  state.snapshot = picture
  state.layer = s.layer
  state.order = s.order
  state.width = s.width
  state.height = s.height
  state.drawn = s.drawn
  state.center[0] = cx
  state.center[1] = cy
  state.lead = s.lead
  state.saturate = s.saturate
  state.lift = s.lift
  state.uniforms = uniforms
  state.key = nextKey()
  model.state = state
  return state
}

/** Takes a new state of a glass, and works out from it and the last one how the glass moves */
function receive(model: Model, s: SentState | null) {
  const prev = model.sent
  model.sent = s
  if (!s) return
  if (!model.known) {
    // what the page says it is, until it moves: a glass in a fixed box stays in place on the screen from the first frame
    // of the first scroll, which the worker hears of before the state that would show it
    model.known = true
    model.anchor = s.fixed ? "screen" : "page"
  }
  const ox = s.center[0] - s.scroll[0]
  const oy = s.center[1] - s.scroll[1]
  if (prev) {
    const centerMoved = Math.hypot(s.center[0] - prev.center[0], s.center[1] - prev.center[1]) >= STILL_PX
    const scrolled = Math.hypot(s.scroll[0] - prev.scroll[0], s.scroll[1] - prev.scroll[1]) >= STILL_PX
    const offsetMoved =
      Math.hypot(ox - (prev.center[0] - prev.scroll[0]), oy - (prev.center[1] - prev.scroll[1])) >= STILL_PX
    // what it does while the page scrolls says what it is; with the page still, only a move of its own says anything
    if (scrolled && !centerMoved) model.anchor = "page"
    else if (scrolled && !offsetMoved) model.anchor = "screen"
    else if (centerMoved && offsetMoved) model.anchor = "own"
  }
  model.offset[0] = ox
  model.offset[1] = oy
  if (model.anchor === "own") model.own.push(s.t, s.center[0], s.center[1])
}

scope.onmessage = ({ data: m }) => {
  switch (m.type) {
    case "add": {
      if (!renderer) return
      const model: Model = {
        id: m.id,
        target: { canvas: m.canvas, frame: (time) => frame(model, time) },
        remove: () => {},
        sent: null,
        anchor: "page",
        offset: [0, 0],
        own: createStreamPredictor(),
        state: null,
        made: { sent: null, picture: null, cx: 0, cy: 0 },
        overlay: null,
        asked: false,
        known: false,
      }
      models.set(m.id, model)
      byTarget.set(model.target, model)
      model.remove = renderer.add(model.target)
      break
    }
    case "remove": {
      const model = models.get(m.id)
      if (!model) return
      model.remove()
      models.delete(m.id)
      byTarget.delete(model.target)
      if (model.overlay?.canvas instanceof ImageBitmap) model.overlay.canvas.close()
      break
    }
    case "state": {
      const model = models.get(m.id)
      if (!model) return
      receive(model, m.state)
      wake()
      break
    }
    case "scroll":
      scroll.push(m.t, m.x, m.y)
      wake()
      break
    case "vsync":
      phase = m.t % PERIOD
      break
    case "snapshot":
      pictures.set(m.id, { canvas: m.bitmap, width: m.width, height: m.height })
      wake(100)
      break
    case "release": {
      const picture = pictures.get(m.id)
      if (!picture) return
      pictures.delete(m.id)
      renderer?.release(picture)
      if (picture.canvas instanceof ImageBitmap) picture.canvas.close()
      break
    }
    case "overlay": {
      const overlay = models.get(m.id)?.overlay
      if (!overlay) {
        m.bitmap.close()
        return
      }
      if (overlay.canvas instanceof ImageBitmap) overlay.canvas.close()
      overlay.canvas = m.bitmap
      overlay.uploaded = false
      overlay.version++
      wake(100)
      break
    }
  }
}
