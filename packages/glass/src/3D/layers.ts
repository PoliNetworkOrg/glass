import { frameScroll, watchFrames } from "../utils/frames"
import { LAYER_ATTRIBUTE, snapshotLayer } from "../utils/snapshot"
import { forgetPicture, takePicture } from "./pictures"
import type { LiveLayer, LiveLayers } from "./renderer"

// The animated layers of the page: elements marked `glass-layer`, which move on their own (blobs drifting in the
// background, a shape that spins). The picture of the page leaves them out. Each has a picture of its own, taken once
// (and again when it changes, as the picture of what a glass has over it is), and on every frame where it is drawn is
// read here, in the read phase of the frame loop: its box, its transform and its opacity, which is what a CSS
// animation that the compositor can run moves. The renderer then draws it there, behind the glass it is under.
// A `<canvas>` layer is different: what the page draws on it is its picture, taken again on every frame.

/** The layers, as the renderer reads them: one list kept from frame to frame, changed in place */
export const liveLayers: LiveLayers = { list: [], set: 0 }

type Watched = {
  element: HTMLElement
  layer: LiveLayer
  /** Its computed style, which is live: kept, and read on every frame */
  style: CSSStyleDeclaration
  /** What its transform was made of when it was last worked out, to work it out only when one of them changes */
  transform: string
  rotate: string
  scale: string
  opacity: string
  /** It is in a box fixed to the screen: asked the first time it is read */
  fixed: boolean | null
}

const watched = new Map<HTMLElement, Watched>()
let ids = 0

/** Whether `element` is in a box fixed to the screen, which keeps it in place there while the page scrolls */
export function inFixedBox(element: HTMLElement) {
  for (let node: Element | null = element; node && node !== document.body; node = node.parentElement) {
    if (getComputedStyle(node).position === "fixed") return true
  }
  return false
}

// Which elements are layers is looked for again whenever the page changes, while something wants to know: the frame
// loop of a renderer, or the capture of the page, which takes what is in front of the layers only where there are some.
const listeners = new Set<() => void>()
let users = 0
let observer: MutationObserver | null = null

function refresh() {
  const found: HTMLElement[] = []
  for (const el of document.querySelectorAll(`[${LAYER_ATTRIBUTE}]`)) if (el instanceof HTMLElement) found.push(el)
  if (found.length === watched.size && found.every((el) => watched.has(el))) return
  const now = new Set(found)
  for (const [el, w] of watched) {
    if (now.has(el)) continue
    watched.delete(el)
    forgetPicture(w.layer)
  }
  for (const element of found) {
    if (watched.has(element)) continue
    watched.set(element, {
      element,
      layer: {
        id: ++ids,
        picture: null,
        margin: 0,
        pictureVersion: 0,
        live: element instanceof HTMLCanvasElement,
        width: 0,
        height: 0,
        center: [0, 0],
        fixed: false,
        matrix: [1, 0, 0, 1],
        opacity: 1,
        visible: false,
        version: 0,
      },
      style: getComputedStyle(element),
      transform: "",
      rotate: "",
      scale: "",
      opacity: "",
      fixed: null,
    })
  }
  // in the order of the document, which is the order they are drawn in
  liveLayers.list.length = 0
  for (const el of found) {
    const w = watched.get(el)
    if (w) liveLayers.list.push(w.layer)
  }
  liveLayers.set++
  for (const listener of listeners) listener()
}

function use() {
  if (users++ > 0) return
  observer = new MutationObserver(refresh)
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [LAYER_ATTRIBUTE],
  })
  refresh()
}

function release() {
  if (--users > 0) return
  observer?.disconnect()
  observer = null
  for (const w of watched.values()) forgetPicture(w.layer)
  watched.clear()
  liveLayers.list.length = 0
  liveLayers.set++
}

/** Calls `listener` whenever which elements are layers changes, until the function it returns is called */
export function onLayersChange(listener: () => void) {
  listeners.add(listener)
  use()
  return () => {
    listeners.delete(listener)
    release()
  }
}

/** Whether the page has layers, as last looked for */
export const hasLayers = () => liveLayers.list.length > 0

/** Reads the layers on every frame, and keeps their pictures, until the function it returns is called */
export function watchLayers() {
  use()
  const stop = watchFrames(() => {
    for (const w of watched.values()) read(w)
    return undefined
  })
  return () => {
    stop()
    release()
  }
}

function read(w: Watched) {
  const { element, layer, style } = w
  const width = element.offsetWidth
  const height = element.offsetHeight
  const visible = width > 0 && height > 0 && style.visibility !== "hidden"
  if (!visible) {
    if (layer.visible) {
      layer.visible = false
      layer.version++
    }
    return
  }
  w.fixed ??= inFixedBox(element)
  // The center of its box, its transform included, is the center of the box it is drawn in: the transform of a box
  // about any origin moves its center to where the box it ends up in is centered
  const rect = element.getBoundingClientRect()
  let cx = rect.left + rect.width / 2
  let cy = rect.top + rect.height / 2
  if (!w.fixed) {
    cx += frameScroll.x
    cy += frameScroll.y
  }
  let changed =
    !layer.visible ||
    layer.fixed !== w.fixed ||
    layer.width !== width ||
    layer.height !== height ||
    layer.center[0] !== cx ||
    layer.center[1] !== cy
  layer.visible = true
  layer.fixed = w.fixed
  layer.width = width
  layer.height = height
  layer.center[0] = cx
  layer.center[1] = cy

  const transform = style.transform
  const rotate = style.rotate
  const scale = style.scale
  if (transform !== w.transform || rotate !== w.rotate || scale !== w.scale) {
    w.transform = transform
    w.rotate = rotate
    w.scale = scale
    if (linear(transform, rotate, scale, layer.matrix)) changed = true
  }
  const opacity = style.opacity
  if (opacity !== w.opacity) {
    w.opacity = opacity
    const value = Number(opacity)
    const next = Number.isFinite(value) ? value : 1
    if (next !== layer.opacity) {
      layer.opacity = next
      changed = true
    }
  }
  if (element instanceof HTMLCanvasElement) {
    // A canvas is its own picture: the page draws on it whenever it wants, which nothing on the page says, and a
    // capture of the page can't see into one anyway. It is taken as it is on every frame it is drawn under a glass.
    layer.picture = element
    layer.margin = 0
    layer.pictureVersion++
    layer.version++
    return
  }
  if (changed) layer.version++

  takePicture(layer, element, deliver(layer), snapshotLayer)
}

/** What puts a new picture of a layer in, one function kept for each */
const deliveries = new WeakMap<LiveLayer, (taken: { canvas: HTMLCanvasElement; margin: number }) => void>()
function deliver(layer: LiveLayer) {
  let d = deliveries.get(layer)
  if (!d) {
    d = ({ canvas, margin }) => {
      const old = layer.picture
      layer.picture = canvas
      layer.margin = margin
      layer.pictureVersion++
      layer.version++
      // a canvas iOS counts against the memory of the page's canvases until it is collected
      if (old instanceof HTMLCanvasElement) {
        old.width = 0
        old.height = 0
      }
    }
    deliveries.set(layer, d)
  }
  return d
}

// The numbers in a value of CSS, read without cutting it into strings: this runs on every frame a layer moves
const numbers = new Float64Array(16)
/** Where each number ends in the value, for its unit */
const ends = new Int32Array(16)

const isDigit = (c: number) => c >= 48 && c <= 57
const isLetter = (c: number) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122)

/** Reads the numbers of `value` into `numbers` (not those in a name, as the 3 of matrix3d): says how many */
function scan(value: string) {
  let count = 0
  let i = 0
  const n = value.length
  while (i < n && count < numbers.length) {
    const c = value.charCodeAt(i)
    const next = i + 1 < n ? value.charCodeAt(i + 1) : 0
    const signed = (c === 45 || c === 43) && (isDigit(next) || next === 46)
    if (!(isDigit(c) || (c === 46 && isDigit(next)) || signed) || (i > 0 && isLetter(value.charCodeAt(i - 1)))) {
      i++
      continue
    }
    let sign = 1
    if (signed) {
      if (c === 45) sign = -1
      i++
    }
    let v = 0
    while (i < n && isDigit(value.charCodeAt(i))) v = v * 10 + (value.charCodeAt(i++) - 48)
    if (i < n && value.charCodeAt(i) === 46) {
      i++
      let f = 0.1
      while (i < n && isDigit(value.charCodeAt(i))) {
        v += (value.charCodeAt(i++) - 48) * f
        f /= 10
      }
    }
    const e = i < n ? value.charCodeAt(i) : 0
    if (e === 101 || e === 69) {
      let j = i + 1
      let es = 1
      if (j < n && (value.charCodeAt(j) === 45 || value.charCodeAt(j) === 43)) {
        if (value.charCodeAt(j) === 45) es = -1
        j++
      }
      if (j < n && isDigit(value.charCodeAt(j))) {
        let x = 0
        while (j < n && isDigit(value.charCodeAt(j))) x = x * 10 + (value.charCodeAt(j++) - 48)
        v *= 10 ** (es * x)
        i = j
      }
    }
    numbers[count] = sign * v
    ends[count] = i
    count++
  }
  return count
}

/** An angle of CSS in radians, from the number at `i` of the last scan and the unit after it */
function angle(value: string, i: number) {
  const v = numbers[i]
  const at = ends[i]
  if (value.startsWith("rad", at)) return v
  if (value.startsWith("turn", at)) return v * Math.PI * 2
  if (value.startsWith("grad", at)) return (v * Math.PI) / 200
  return (v * Math.PI) / 180
}

/**
 * The linear part of what a box is drawn through: `rotate`, then `scale`, then `transform`, as CSS applies them (their
 * moves are in where the box is, which is read from it). Only what turns in the plane of the page: a turn about
 * another axis is left out. Into `out`, as a, b, c, d: says whether it changed.
 */
function linear(transform: string, rotate: string, scale: string, out: LiveLayer["matrix"]) {
  let a = 1
  let b = 0
  let c = 0
  let d = 1
  if (transform && transform !== "none") {
    const count = scan(transform)
    if (transform.startsWith("matrix3d") && count >= 16) {
      a = numbers[0]
      b = numbers[1]
      c = numbers[4]
      d = numbers[5]
    } else if (count >= 6) {
      a = numbers[0]
      b = numbers[1]
      c = numbers[2]
      d = numbers[3]
    }
  }
  if (scale && scale !== "none") {
    const count = scan(scale)
    if (count >= 1) {
      const sx = numbers[0]
      const sy = count >= 2 ? numbers[1] : sx
      a *= sx
      c *= sx
      b *= sy
      d *= sy
    }
  }
  if (rotate && rotate !== "none") {
    // "45deg", or an axis and an angle: "z 45deg", "0 0 1 45deg"
    const count = scan(rotate)
    let turn: number | null = null
    if (count === 1) turn = rotate.startsWith("x") || rotate.startsWith("y") ? null : angle(rotate, 0)
    else if (count === 4 && numbers[0] === 0 && numbers[1] === 0 && numbers[2] !== 0) {
      turn = angle(rotate, 3) * Math.sign(numbers[2])
    }
    if (turn !== null) {
      const cos = Math.cos(turn)
      const sin = Math.sin(turn)
      const na = cos * a - sin * b
      const nb = sin * a + cos * b
      const nc = cos * c - sin * d
      const nd = sin * c + cos * d
      a = na
      b = nb
      c = nc
      d = nd
    }
  }
  const changed = out[0] !== a || out[1] !== b || out[2] !== c || out[3] !== d
  out[0] = a
  out[1] = b
  out[2] = c
  out[3] = d
  return changed
}
