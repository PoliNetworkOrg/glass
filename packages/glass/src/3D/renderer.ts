import { drawFrames, frameScroll } from "../utils/frames"
import { createPredictor } from "../utils/predict"
import { onMediaChange, type Snapshot, snapshotElement } from "../utils/snapshot"
import { GLASS_FRAGMENT, GLASS_VERTEX, PAGE_FRAGMENT, PAGE_VERTEX } from "./composite"
import {
  BLUR_FRAGMENT,
  BLUR_VERTEX,
  blurScale,
  fragment,
  frostSigma,
  type GlassUniforms,
  QUAD,
  VERTEX,
} from "./displacement"

// One WebGL context draws every glass on the page. docs/ARCHITECTURE.md walks through the passes below.
//
// A context per glass held a copy of the picture of the page each (WebGL contexts share nothing), uploaded it again on
// every capture, and ran into the browser's cap on contexts: Chrome keeps 16 and drops the oldest, whose glass goes
// blank. Here the picture is on the GPU once.
//
// Each glass is drawn into a texture of its own, which it keeps, and the ones drawn on a frame are copied side by side
// onto the canvas of the context, which is taken as one bitmap and copied, a piece to each, to the 2D canvas the glass
// shows. One bitmap and not a copy from the canvas per glass: Firefox reads a WebGL canvas back to the CPU on every
// copy, 137ms a frame for 16 glasses, against 12ms for one bitmap and its pieces. In Chrome either is a fraction of a ms.
//
// Glass is in layers. The glass of layer 0, all of it unless it is told otherwise, bends the picture of the page,
// which has no glass in it. The glass of a higher layer bends what is behind it on the screen: the page, and the glass
// of the layers below as it was drawn, with what each has over its glass (its tint, its edges, its content, from a
// picture of the element, taken when it changes). That backdrop is drawn for the region the layer covers, only when
// something in it moved or changed.

/** Where a glass is and how it is drawn, on a frame */
export type GlassState = {
  snapshot: Snapshot
  layer: number
  /** The element of the glass, whose picture is what it has over its glass */
  element: HTMLElement
  /** The size of the box of the element, which is the size of its canvas, in px */
  width: number
  height: number
  /** The size it is drawn at, transforms included */
  drawn: [number, number]
  /** Where its center is on the page, where it will be when the frame is on screen */
  center: [number, number]
  /** How far ahead, in ms, the page is drawn while it moves */
  lead: number
  /** The saturate() of the glass */
  saturate: number
  /** The power its colors are raised to */
  lift: number
  /** The profile, with the page as its backdrop */
  uniforms: GlassUniforms
  /**
   * Everything about what it draws apart from what is behind it, as a number that is new whenever any of it changes
   * ({@link nextKey}): when it is the same, so is what it draws. A number and not a string of what it is made of, which
   * was garbage on every frame of a scroll for the glass that stays in place on the screen.
   */
  key: number
}

export type GlassTarget = {
  /** The canvas the glass is shown on */
  canvas: HTMLCanvasElement
  /** Called on every frame: where it is and how it is drawn, or null where it has no size */
  frame: (time: number) => GlassState | null
}

/** How wide the canvas the glasses are copied to is let to grow before they are put on more rows */
const ROW_WIDTH = 2048
/** How much of what is around a glass is in the picture of what it has over its glass, in px */
const OVERLAY_MARGIN = 8
/** How much more than its frost reads is drawn behind a higher layer, around its glass, in px */
const BACKDROP_MARGIN = 4
/**
 * The pictures of what a glass has over it wait while the page scrolls faster than this, in px per ms, and for `CALM`
 * ms after: each one lays out and paints a copy of the element with all of the page's CSS on the main thread, and
 * during a flick the header and tab bar ran into a new caption bar every 50ms or so, which made frames late and a
 * megabyte a second of garbage. Until its picture is taken, a glass shows under a higher layer without what it has
 * over its glass, for as long as it moves too fast to read.
 */
const CAPTURE_SPEED = 0.5
const CALM = 100

/** A new number for a new state of a glass: its key, see {@link GlassState} */
let keys = 0
export const nextKey = () => ++keys

type Program = {
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  uniforms: Record<string, WebGLUniformLocation | null>
}

const GLASS_UNIFORMS = [
  "uMap",
  "uTexSize",
  "uBg",
  "uSize",
  "uRadius",
  "uExp",
  "uBezel",
  "uShift",
  "uCurve",
  "uDispersion",
  "uSaturate",
  "uLift",
]
const BLUR_UNIFORMS = ["uSource", "uStep", "uSigma", "uRadius", "uEncoded"]
const PAGE_UNIFORMS = ["uPage", "uPageSize", "uRegion", "uScroll"]
const COMPOSITE_UNIFORMS = [
  "uGlass",
  "uOverlay",
  "uHasOverlay",
  "uDrawn",
  "uScale",
  "uOverlaySize",
  "uRadius",
  "uExp",
  "uCenter",
  "uHalf",
  "uRegion",
]

function link(gl: WebGL2RenderingContext, vertex: string, fragmentSource: string, names: string[]): Program {
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)
    if (!s) throw new Error("glass: no shader")
    gl.shaderSource(s, source)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`glass: ${gl.getShaderInfoLog(s)}`)
    return s
  }
  const program = gl.createProgram()
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex))
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource))
  gl.bindAttribLocation(program, 0, "aPos")
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`glass: ${gl.getProgramInfoLog(program)}`)

  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  const uniforms = Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]))
  return { program, vao, uniforms }
}

/** How far a blur of `sigma` px reads on each side, in px: past three sigmas its weights are under 1% */
const blurReach = (sigma: number) => Math.ceil(sigma * 3)

/** A texture that is drawn into */
type Target = { fbo: WebGLFramebuffer; texture: WebGLTexture; width: number; height: number }

/** The picture of what a glass has over its glass, and whether it is still what the element looks like */
type Overlay = {
  canvas: HTMLCanvasElement | null
  texture: WebGLTexture | null
  uploaded: boolean
  version: number
  stale: boolean
  capturing: boolean
  disconnect: () => void
}

type Entry = {
  target: GlassTarget
  /** The glass as the frame hands it around, one object kept from frame to frame */
  glass: Glass | null
  /** What the glass drew last, kept for the layers above it */
  output: Target | null
  /** What it was drawn with: its key, its picture of the page and the version of its backdrop (0 for none) */
  key: number
  snapshot: Snapshot | null
  backdrop: number
  /** The time the context had come back, when it was drawn */
  generation: number
  /** Counts its drawings, so that a backdrop with it in it knows to be drawn again */
  version: number
  overlay: Overlay | null
  /** What is behind it, for the glass of a higher layer */
  behind: Backdrop | null
  /** The glass below that is in its backdrop, and what the backdrop was last drawn from, kept from frame to frame */
  under: Glass[]
  drawnFrom: unknown[]
  /** What is behind it blurred by its frost, and the blur across it, which the blur down it reads */
  frosted: Target | null
  across: Target | null
}

type Glass = { target: GlassTarget; entry: Entry; state: GlassState }

/**
 * What is behind a higher layer: drawn for the region of the screen the layer covers. Its version, unique across the
 * renderer, changes whenever it is drawn again, which is how the glass on it knows to be drawn again.
 */
type Backdrop = Target & { version: number; region: [number, number, number, number] }

const followsInDocument = (a: Glass, b: Glass) =>
  a.state.element.compareDocumentPosition(b.state.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
/** From the bottom up: by layer, then in the order of the document */
const bottomUp = (a: Glass, b: Glass) => a.state.layer - b.state.layer || followsInDocument(a, b)
const ascending = (a: number, b: number) => a - b

/** Writes `value` at `i` of `list`, and says whether it was something else there */
const put = (list: unknown[], i: number, value: unknown) => {
  if (list[i] === value) return false
  list[i] = value
  return true
}

class GlassRenderer {
  private readonly canvas: OffscreenCanvas | HTMLCanvasElement
  private readonly gl: WebGL2RenderingContext
  private glass!: Program
  private glassOnBackdrop!: Program
  private page!: Program
  private composite!: Program
  private blur!: Program
  private readonly textures = new Map<Snapshot, WebGLTexture>()
  /** The pictures blurred by a frost, by its sigma */
  private readonly blurs = new Map<Snapshot, Map<number, Target>>()
  private readonly entries = new Map<GlassTarget, Entry>()
  private readonly contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D | null>()
  /** Where the page is scrolled, ahead by the lead as the glass is */
  private readonly scroll = createPredictor()
  /**
   * The lists a frame is drawn with, emptied and filled again on every one: this runs on every frame, and new lists
   * each time were garbage that Safari collected in pauses of 30 to 60ms
   */
  private readonly frameGlasses: Glass[] = []
  private readonly frameLayers: number[] = []
  private readonly frameBelow: Glass[] = []
  private readonly frameDrawn: Glass[] = []
  /** Counts the drawings of the backdrops, for their versions */
  private backdropVersion = 0
  /** The time of this frame, and the last one the page scrolled faster than {@link CAPTURE_SPEED} */
  private now = 0
  private fastAt = Number.NEGATIVE_INFINITY
  private stop: (() => void) | null = null
  private lost = false
  /** One picture of an element is taken at a time */
  private capturing = false
  /** Counts the times the context came back, so the glasses know to draw again */
  private generation = 0

  constructor() {
    this.canvas = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(1, 1) : document.createElement("canvas")
    const gl = this.canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      // not "high-performance": on a laptop with two GPUs that wakes the discrete one, and its battery with it, for what
      // is one read of a texture a pixel; a phone has one GPU either way
    }) as WebGL2RenderingContext | null
    if (!gl) throw new Error("glass: no WebGL2")
    this.gl = gl
    this.compile()

    // the pictures of the elements too look different when a media query of the page changes (the device's theme)
    onMediaChange(() => {
      for (const entry of this.entries.values()) if (entry.overlay) entry.overlay.stale = true
    })

    const canvas = this.canvas as EventTarget
    canvas.addEventListener("webglcontextlost", (e) => {
      // so that it can come back
      e.preventDefault()
      this.lost = true
    })
    canvas.addEventListener("webglcontextrestored", () => {
      // everything that was on the GPU is gone with it
      this.textures.clear()
      this.blurs.clear()
      for (const entry of this.entries.values()) {
        entry.output = null
        entry.behind = null
        entry.frosted = null
        entry.across = null
        if (entry.overlay) {
          entry.overlay.texture = null
          entry.overlay.uploaded = false
        }
      }
      this.compile()
      this.lost = false
      this.generation++
    })
  }

  private compile() {
    const gl = this.gl
    this.glass = link(gl, VERTEX, fragment(false), GLASS_UNIFORMS)
    this.glassOnBackdrop = link(gl, VERTEX, fragment(true), GLASS_UNIFORMS)
    this.page = link(gl, PAGE_VERTEX, PAGE_FRAGMENT, PAGE_UNIFORMS)
    this.composite = link(gl, GLASS_VERTEX, GLASS_FRAGMENT, COMPOSITE_UNIFORMS)
    this.blur = link(gl, BLUR_VERTEX, BLUR_FRAGMENT, BLUR_UNIFORMS)
  }

  /** Draws `target` on every frame, until the function it returns is called */
  add(target: GlassTarget) {
    this.entries.set(target, {
      target,
      glass: null,
      output: null,
      key: 0,
      snapshot: null,
      backdrop: 0,
      generation: -1,
      version: 0,
      overlay: null,
      behind: null,
      under: [],
      drawnFrom: [],
      frosted: null,
      across: null,
    })
    this.stop ??= drawFrames((time) => this.draw(time))
    return () => {
      const entry = this.entries.get(target)
      this.entries.delete(target)
      if (entry) this.free(entry)
      if (this.entries.size === 0) {
        this.stop?.()
        this.stop = null
      }
    }
  }

  private free(entry: Entry) {
    const gl = this.gl
    for (const target of [entry.output, entry.behind, entry.frosted, entry.across]) if (target) this.drop(target)
    if (entry.overlay) {
      entry.overlay.disconnect()
      if (entry.overlay.texture) gl.deleteTexture(entry.overlay.texture)
    }
  }

  private drop(target: Target) {
    this.gl.deleteFramebuffer(target.fbo)
    this.gl.deleteTexture(target.texture)
  }

  /** Frees the GPU copies of a picture that is no longer drawn: as it is, and blurred */
  release(snapshot: Snapshot) {
    const texture = this.textures.get(snapshot)
    if (texture) this.gl.deleteTexture(texture)
    this.textures.delete(snapshot)
    for (const blurred of this.blurs.get(snapshot)?.values() ?? []) this.drop(blurred)
    this.blurs.delete(snapshot)
  }

  /**
   * The picture on the GPU, uploaded the first time it is drawn: sRGB, flipped. Without mipmaps: the glass reads it a
   * pixel of the picture to a pixel of its canvas, and its frost reads a blur of it, so they would only take a third
   * more memory and a pass over the whole page on every capture.
   */
  private texture(snapshot: Snapshot) {
    const gl = this.gl
    let texture = this.textures.get(snapshot)
    if (texture) return texture
    texture = gl.createTexture()
    const { width, height } = snapshot.canvas
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.SRGB8_ALPHA8, width, height)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, snapshot.canvas)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    this.textures.set(snapshot, texture)
    return texture
  }

  /**
   * The picture blurred by a frost, blurred the first time a glass with that frost draws it. The frost is the same
   * blur wherever the glass bends the page, so it is the page that is blurred, once, and the glass reads it once a
   * pixel: averaging the page around each pixel of each glass on each frame took 25 reads a pixel, 75 with dispersion.
   */
  private frosted(snapshot: Snapshot, frost: number) {
    if (frost <= 0) return this.texture(snapshot)
    const sigma = frostSigma(frost)
    let bySigma = this.blurs.get(snapshot)
    if (!bySigma) {
      bySigma = new Map()
      this.blurs.set(snapshot, bySigma)
    }
    let blurred = bySigma.get(sigma)
    if (!blurred) {
      const { width, height } = snapshot.canvas
      const [across, down] = this.blurInto(this.texture(snapshot), width, height, sigma, false, null, null)
      this.drop(across)
      blurred = down
      bySigma.set(sigma, blurred)
    }
    return blurred.texture
  }

  /**
   * Blurs `source`, of `width` x `height` px, by `sigma` px: across into `across`, then down into `down`, made or
   * resized to fit, at the size {@link blurScale} keeps it. Both cover the whole of the source, so a point of the
   * source is at the same uv in them.
   *
   * @param encoded The source holds sRGB values the GPU doesn't decode (what is behind a higher layer)
   * @returns `across` and `down`, sRGB textures read in linear light
   */
  private blurInto(
    source: WebGLTexture,
    width: number,
    height: number,
    sigma: number,
    encoded: boolean,
    across: Target | null,
    down: Target | null
  ): [Target, Target] {
    const gl = this.gl
    const scale = blurScale(sigma)
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    const a = this.target(across, w, height, true, gl.SRGB8_ALPHA8)
    const d = this.target(down, w, h, true, gl.SRGB8_ALPHA8)
    const b = this.blur
    gl.useProgram(b.program)
    gl.bindVertexArray(b.vao)
    gl.activeTexture(gl.TEXTURE0)
    gl.uniform1i(b.uniforms.uSource, 0)
    gl.uniform1f(b.uniforms.uSigma, sigma)
    gl.uniform1i(b.uniforms.uRadius, blurReach(sigma))

    gl.bindFramebuffer(gl.FRAMEBUFFER, a.fbo)
    gl.viewport(0, 0, w, height)
    gl.bindTexture(gl.TEXTURE_2D, source)
    gl.uniform2f(b.uniforms.uStep, 1 / width, 0)
    gl.uniform1i(b.uniforms.uEncoded, encoded ? 1 : 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    gl.bindFramebuffer(gl.FRAMEBUFFER, d.fbo)
    gl.viewport(0, 0, w, h)
    gl.bindTexture(gl.TEXTURE_2D, a.texture)
    gl.uniform2f(b.uniforms.uStep, 0, 1 / height)
    gl.uniform1i(b.uniforms.uEncoded, 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    return [a, d]
  }

  /** A texture of at least `width` x `height` to draw into, `current` if it is big enough. It only ever grows. */
  private target(
    current: Target | null,
    width: number,
    height: number,
    exact: boolean,
    format: number = this.gl.RGBA8
  ): Target {
    if (
      current &&
      (exact
        ? current.width === width && current.height === height
        : current.width >= width && current.height >= height)
    ) {
      return current
    }
    const gl = this.gl
    if (current) this.drop(current)
    const w = exact ? width : Math.max(width, current?.width ?? 0)
    const h = exact ? height : Math.max(height, current?.height ?? 0)
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texStorage2D(gl.TEXTURE_2D, 1, format, w, h)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    return { fbo, texture, width: w, height: h }
  }

  /**
   * Takes the picture of what a glass has over its glass, the first time a layer above needs it and again when the
   * element changes (its content, its attributes, its size). The press of a glass moves and lights its element
   * through its own style, and its canvas is redrawn on every frame, so neither counts.
   */
  private overlay(entry: Entry, state: GlassState): Overlay {
    let overlay = entry.overlay
    if (!overlay) {
      const el = state.element
      const created: Overlay = {
        canvas: null,
        texture: null,
        uploaded: false,
        version: 0,
        stale: true,
        capturing: false,
        disconnect: () => {},
      }
      const mutations = new MutationObserver((records) => {
        const own = (r: MutationRecord) =>
          r.type === "attributes" && (r.target === el || r.target instanceof HTMLCanvasElement)
        if (records.some((r) => !own(r))) created.stale = true
      })
      mutations.observe(el, { subtree: true, childList: true, attributes: true, characterData: true })
      // it reports the size it starts with too, which the picture about to be taken already has
      let size = ""
      const resizes = new ResizeObserver(([entry]) => {
        const next = `${entry.contentRect.width}x${entry.contentRect.height}`
        if (size && next !== size) created.stale = true
        size = next
      })
      resizes.observe(el)
      created.disconnect = () => {
        mutations.disconnect()
        resizes.disconnect()
      }
      overlay = created
      entry.overlay = created
    }
    const calm = this.now - this.fastAt >= CALM
    if (overlay.stale && !overlay.capturing && !this.capturing && calm) {
      const o = overlay
      o.capturing = true
      o.stale = false
      this.capturing = true
      snapshotElement(state.element, OVERLAY_MARGIN)
        .then(({ canvas, fresh }) => {
          o.canvas = canvas
          o.uploaded = false
          o.version++
          // taken again a moment later, in case WebKit drew it before decoding the images that are new in it
          if (fresh) {
            setTimeout(() => {
              o.stale = true
            }, 400)
          }
        })
        .catch(() => {
          /* the element couldn't be drawn: the glass is shown without what it has over it */
        })
        .finally(() => {
          o.capturing = false
          this.capturing = false
        })
    }
    return overlay
  }

  /**
   * What is behind a glass of a higher layer, drawn for the region of the screen it covers, or null where none of the
   * glass below is in that region, and the glass bends the picture of the page as layer 0 does. Each glass has its
   * own: a fixed header and a fixed tab bar together would cover the whole screen, drawn again on every frame of a
   * scroll, and on their own they cover two strips of it.
   */
  private backdrop(glass: Glass, below: Glass[], scrollX: number, scrollY: number): Backdrop | null {
    const { entry, state } = glass
    // the region: where the glass is on the screen, and as far around it as the blur of its frost reads
    const reach = (state.uniforms.frost > 0 ? blurReach(frostSigma(state.uniforms.frost)) : 0) + BACKDROP_MARGIN
    const gx = state.center[0] - scrollX
    const gy = state.center[1] - scrollY
    const rx = Math.floor(gx - state.drawn[0] / 2 - reach)
    const ry = Math.floor(gy - state.drawn[1] / 2 - reach)
    const rw = Math.ceil(gx + state.drawn[0] / 2 + reach) - rx
    const rh = Math.ceil(gy + state.drawn[1] / 2 + reach) - ry

    // the glass below that is in it, from the bottom up
    const under = entry.under
    under.length = 0
    for (const other of below) {
      const o = other.state
      const cx = o.center[0] - scrollX
      const cy = o.center[1] - scrollY
      const hw = (o.drawn[0] * (o.width + OVERLAY_MARGIN * 2)) / o.width / 2
      const hh = (o.drawn[1] * (o.height + OVERLAY_MARGIN * 2)) / o.height / 2
      if (cx + hw > rx && cx - hw < rx + rw && cy + hh > ry && cy - hh < ry + rh) under.push(other)
    }
    if (under.length === 0) return null
    if (under.length > 1) under.sort(bottomUp)

    // What it is drawn from, compared with what it was last drawn from one value at a time, in place: no key to build
    // and throw away on every frame
    const snapshot = state.snapshot
    const from = entry.drawnFrom
    let n = 0
    let changed = put(from, n++, rx)
    changed = put(from, n++, ry) || changed
    changed = put(from, n++, rw) || changed
    changed = put(from, n++, rh) || changed
    changed = put(from, n++, scrollX) || changed
    changed = put(from, n++, scrollY) || changed
    changed = put(from, n++, snapshot) || changed
    for (const { entry: e, state: s } of under) {
      const overlay = this.overlay(e, s)
      changed = put(from, n++, e) || changed
      changed = put(from, n++, e.version) || changed
      changed = put(from, n++, s.key) || changed
      changed = put(from, n++, s.center[0]) || changed
      changed = put(from, n++, s.center[1]) || changed
      changed = put(from, n++, overlay.version) || changed
    }
    if (from.length !== n) {
      from.length = n
      changed = true
    }

    const current = entry.behind
    const target = this.target(current, rw, rh, false)
    let backdrop: Backdrop
    if (current && target === current) backdrop = current
    else {
      // a new texture, bigger, which has nothing drawn in it yet
      backdrop = { ...target, version: 0, region: [rx, ry, rw, rh] }
      entry.behind = backdrop
      changed = true
    }
    if (!changed) return backdrop
    backdrop.version = ++this.backdropVersion
    backdrop.region[0] = rx
    backdrop.region[1] = ry
    backdrop.region[2] = rw
    backdrop.region[3] = rh

    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, backdrop.fbo)
    gl.viewport(0, 0, rw, rh)

    // the page
    const page = this.page
    gl.useProgram(page.program)
    gl.bindVertexArray(page.vao)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture(snapshot))
    gl.uniform1i(page.uniforms.uPage, 0)
    gl.uniform2f(page.uniforms.uPageSize, snapshot.width, snapshot.height)
    gl.uniform4f(page.uniforms.uRegion, rx, ry, rw, rh)
    gl.uniform2f(page.uniforms.uScroll, scrollX, scrollY)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    // and the glass below, each as it was drawn, under what it has over it
    const c = this.composite
    gl.useProgram(c.program)
    gl.bindVertexArray(c.vao)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.uniform4f(c.uniforms.uRegion, rx, ry, rw, rh)
    gl.uniform1i(c.uniforms.uGlass, 0)
    gl.uniform1i(c.uniforms.uOverlay, 1)
    for (const { entry, state } of under) {
      if (!entry.output) continue
      const overlay = this.overlay(entry, state)
      const hasOverlay = overlay.canvas !== null
      if (hasOverlay) this.uploadOverlay(overlay)
      const scale: [number, number] = [state.drawn[0] / state.width, state.drawn[1] / state.height]
      const overlaySize: [number, number] = [state.width + OVERLAY_MARGIN * 2, state.height + OVERLAY_MARGIN * 2]
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, entry.output.texture)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, hasOverlay ? overlay.texture : null)
      gl.uniform1i(c.uniforms.uHasOverlay, hasOverlay ? 1 : 0)
      gl.uniform2f(c.uniforms.uCenter, state.center[0] - scrollX, state.center[1] - scrollY)
      gl.uniform2f(
        c.uniforms.uHalf,
        hasOverlay ? (overlaySize[0] * scale[0]) / 2 : state.drawn[0] / 2 + 1,
        hasOverlay ? (overlaySize[1] * scale[1]) / 2 : state.drawn[1] / 2 + 1
      )
      gl.uniform2f(c.uniforms.uDrawn, state.drawn[0], state.drawn[1])
      gl.uniform2f(c.uniforms.uScale, scale[0], scale[1])
      gl.uniform2f(c.uniforms.uOverlaySize, overlaySize[0], overlaySize[1])
      gl.uniform1f(c.uniforms.uRadius, state.uniforms.radius)
      gl.uniform1f(c.uniforms.uExp, state.uniforms.exponent)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    gl.disable(gl.BLEND)
    gl.activeTexture(gl.TEXTURE0)
    return backdrop
  }

  private uploadOverlay(overlay: Overlay) {
    if (overlay.uploaded || !overlay.canvas) return
    const gl = this.gl
    overlay.texture ??= gl.createTexture()
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, overlay.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, overlay.canvas)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.activeTexture(gl.TEXTURE0)
    overlay.uploaded = true
  }

  /** Draws a glass into its own texture, bending the page, or `backdrop` for the glass of a higher layer */
  private drawGlass({ entry, state }: Glass, backdrop: Backdrop | null, scrollX: number, scrollY: number) {
    const gl = this.gl
    const g = state.uniforms
    // what it bends, frosted: the page blurred once for all the glass, or what is behind it, blurred for it alone
    let map: WebGLTexture
    let encoded = false
    if (!backdrop) map = this.frosted(state.snapshot, g.frost)
    else if (g.frost > 0) {
      ;[entry.across, entry.frosted] = this.blurInto(
        backdrop.texture,
        backdrop.width,
        backdrop.height,
        frostSigma(g.frost),
        true,
        entry.across,
        entry.frosted
      )
      map = entry.frosted.texture
    } else {
      map = backdrop.texture
      encoded = true
    }

    const output = this.target(entry.output, state.width, state.height, true)
    entry.output = output
    gl.bindFramebuffer(gl.FRAMEBUFFER, output.fbo)
    gl.viewport(0, 0, state.width, state.height)

    const program = encoded ? this.glassOnBackdrop : this.glass
    const u = program.uniforms
    gl.useProgram(program.program)
    gl.bindVertexArray(program.vao)
    gl.activeTexture(gl.TEXTURE0)
    gl.uniform1i(u.uMap, 0)
    gl.bindTexture(gl.TEXTURE_2D, map)
    if (backdrop) {
      // Where the center of the backdrop texture is, from the center of the glass, y up. The region is at the bottom
      // left of the texture, which only ever grows.
      const [rx, ry, , rh] = backdrop.region
      const gx = state.center[0] - scrollX
      const gy = state.center[1] - scrollY
      gl.uniform2f(u.uTexSize, backdrop.width, backdrop.height)
      gl.uniform2f(u.uBg, backdrop.width / 2 - (gx - rx), backdrop.height / 2 - (ry + rh - gy))
    } else {
      gl.uniform2f(u.uTexSize, state.snapshot.width, state.snapshot.height)
      gl.uniform2f(u.uBg, g.bg[0], g.bg[1])
    }
    gl.uniform2f(u.uSize, g.size[0], g.size[1])
    gl.uniform1f(u.uRadius, g.radius)
    gl.uniform1f(u.uExp, g.exponent)
    gl.uniform1f(u.uBezel, g.bezel)
    gl.uniform1f(u.uShift, g.shift)
    gl.uniform1f(u.uCurve, g.curve)
    gl.uniform1f(u.uDispersion, g.dispersion)
    gl.uniform1f(u.uSaturate, state.saturate)
    gl.uniform1f(u.uLift, state.lift)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    entry.key = state.key
    entry.snapshot = state.snapshot
    entry.backdrop = backdrop ? backdrop.version : 0
    entry.generation = this.generation
    entry.version++
  }

  private draw(time: number) {
    if (this.lost || this.gl.isContextLost()) return
    this.now = time
    if (frameScroll.speed > CAPTURE_SPEED) this.fastAt = time
    const glasses = this.frameGlasses
    glasses.length = 0
    for (const entry of this.entries.values()) {
      const state = entry.target.frame(time)
      if (!state || state.width <= 0 || state.height <= 0) continue
      if (entry.glass) entry.glass.state = state
      else entry.glass = { target: entry.target, entry, state }
      glasses.push(entry.glass)
    }
    if (glasses.length === 0) return
    const [scrollX, scrollY] = this.scroll(time, frameScroll.x, frameScroll.y, glasses[0].state.lead)

    // from the bottom layer up: each is drawn before the ones above it, which may be drawn over it
    const layers = this.frameLayers
    layers.length = 0
    for (const { state } of glasses) if (!layers.includes(state.layer)) layers.push(state.layer)
    layers.sort(ascending)
    const drawn = this.frameDrawn
    drawn.length = 0
    const below = this.frameBelow
    below.length = 0
    for (const layer of layers) {
      for (const glass of glasses) {
        if (glass.state.layer !== layer) continue
        const { entry, state } = glass
        const backdrop = below.length > 0 ? this.backdrop(glass, below, scrollX, scrollY) : null
        const same =
          entry.generation === this.generation &&
          entry.key === state.key &&
          entry.snapshot === state.snapshot &&
          entry.backdrop === (backdrop ? backdrop.version : 0)
        if (same && entry.output) continue
        this.drawGlass(glass, backdrop, scrollX, scrollY)
        drawn.push(glass)
      }
      for (const glass of glasses) if (glass.state.layer === layer) below.push(glass)
    }
    if (drawn.length > 0) this.show(drawn)
  }

  /** Copies the glasses drawn on this frame to their canvases */
  private show(drawn: Glass[]) {
    // the glasses side by side, in rows, from the top left
    const slots: [number, number][] = []
    const rowWidth = Math.max(ROW_WIDTH, ...drawn.map(({ state }) => state.width))
    let x = 0
    let y = 0
    let rowHeight = 0
    let width = 0
    for (const { state } of drawn) {
      if (x > 0 && x + state.width > rowWidth) {
        y += rowHeight
        x = 0
        rowHeight = 0
      }
      slots.push([x, y])
      x += state.width
      rowHeight = Math.max(rowHeight, state.height)
      width = Math.max(width, x)
    }
    const height = y + rowHeight

    // Taken as a bitmap (an OffscreenCanvas), the canvas is exactly as big as what is drawn on this frame: the bitmap
    // takes its buffer, and it gets a new one as big as itself either way, so a canvas grown once for every glass on the
    // page (1819x352 on a phone, at load) made 2.5MB of bitmap on every frame of a scroll that redraws a header and a tab
    // bar. Safari counts that as memory to collect, and ran a full collection, 40 to 60ms with nothing drawn, about every
    // 220ms of a flick. Copied from directly (a <canvas>), it only ever grows: there resizing is what costs.
    const canvas = this.canvas
    const bitmap = "transferToImageBitmap" in canvas
    if (bitmap ? canvas.width !== width || canvas.height !== height : canvas.width < width || canvas.height < height) {
      canvas.width = bitmap ? width : Math.max(canvas.width, width)
      canvas.height = bitmap ? height : Math.max(canvas.height, height)
    }

    const gl = this.gl
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
    drawn.forEach(({ entry, state }, i) => {
      if (!entry.output) return
      const [sx, sy] = slots[i]
      // GL counts rows from the bottom of the canvas
      const glY = canvas.height - sy - state.height
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, entry.output.fbo)
      gl.blitFramebuffer(
        0,
        0,
        state.width,
        state.height,
        sx,
        glY,
        sx + state.width,
        glY + state.height,
        gl.COLOR_BUFFER_BIT,
        gl.NEAREST
      )
    })
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    const source = "transferToImageBitmap" in canvas ? canvas.transferToImageBitmap() : canvas
    drawn.forEach(({ target, state }, i) => {
      const [sx, sy] = slots[i]
      const out = target.canvas
      // resizing a canvas clears it, and it is drawn right after
      if (out.width !== state.width || out.height !== state.height) {
        out.width = state.width
        out.height = state.height
      }
      let ctx = this.contexts.get(out)
      if (ctx === undefined) {
        ctx = out.getContext("2d")
        this.contexts.set(out, ctx)
      }
      ctx?.drawImage(source, sx, sy, state.width, state.height, 0, 0, state.width, state.height)
    })
    if (source instanceof ImageBitmap) source.close()
  }
}

/** The renderer, made the first time it is asked for: null where the device has no WebGL2 */
let renderer: GlassRenderer | null | undefined

export function getRenderer(): GlassRenderer | null {
  if (renderer === undefined) {
    try {
      renderer = typeof document === "undefined" ? null : new GlassRenderer()
    } catch {
      renderer = null
    }
  }
  return renderer
}

/**
 * Frees a picture of the page, once nothing draws it anymore: its copy on the GPU, and its canvas, which is as big as
 * the page and which iOS counts against a cap on the memory of all the canvases of the page until it is collected.
 */
export function releaseSnapshot(snapshot: Snapshot) {
  renderer?.release(snapshot)
  snapshot.canvas.width = 0
  snapshot.canvas.height = 0
}
