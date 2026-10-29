import { drawFrames, frameScroll } from "../utils/frames"
import { createPredictor } from "../utils/predict"
import { type Snapshot, snapshotElement } from "../utils/snapshot"
import { GLASS_FRAGMENT, GLASS_VERTEX, PAGE_FRAGMENT, PAGE_VERTEX } from "./composite"
import { fragment, type GlassUniforms, QUAD, VERTEX } from "./displacement"

// One WebGL context draws every glass on the page.
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
  /** The saturate() of its canvas */
  saturate: number
  /** The profile, with the page as its backdrop */
  uniforms: GlassUniforms
  /** Everything about what it draws apart from what is behind it: when it is the same, so is what it draws */
  key: string
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
/** How much more than its frost reaches is drawn behind a higher layer, around its glass, in px */
const BACKDROP_MARGIN = 4

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
  "uOrigin",
  "uRadius",
  "uExp",
  "uBezel",
  "uShift",
  "uCurve",
  "uDispersion",
  "uFrost",
]
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
  "uSaturate",
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
  /** What the glass drew last, kept for the layers above it */
  output: Target | null
  /** What it was drawn with: its key, its picture of the page and its backdrop */
  key: string
  snapshot: Snapshot | null
  backdrop: string
  /** The time the context had come back, when it was drawn */
  generation: number
  /** Counts its drawings, so that a backdrop with it in it knows to be drawn again */
  version: number
  overlay: Overlay | null
}

type Glass = { target: GlassTarget; entry: Entry; state: GlassState }

/** What is behind a higher layer: drawn for the region of the screen the layer covers */
type Backdrop = Target & { key: string; region: [number, number, number, number] }

const followsInDocument = (a: Glass, b: Glass) =>
  a.state.element.compareDocumentPosition(b.state.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1

class GlassRenderer {
  private readonly canvas: OffscreenCanvas | HTMLCanvasElement
  private readonly gl: WebGL2RenderingContext
  private glass!: Program
  private glassOnBackdrop!: Program
  private page!: Program
  private composite!: Program
  private readonly textures = new Map<Snapshot, WebGLTexture>()
  private readonly entries = new Map<GlassTarget, Entry>()
  private readonly backdrops = new Map<number, Backdrop>()
  private readonly contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D | null>()
  private readonly snapshotIds = new WeakMap<Snapshot, number>()
  private nextSnapshotId = 0
  /** Where the page is scrolled, ahead by the lead as the glass is */
  private readonly scroll = createPredictor()
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
      powerPreference: "high-performance",
    }) as WebGL2RenderingContext | null
    if (!gl) throw new Error("glass: no WebGL2")
    this.gl = gl
    this.compile()

    const canvas = this.canvas as EventTarget
    canvas.addEventListener("webglcontextlost", (e) => {
      // so that it can come back
      e.preventDefault()
      this.lost = true
    })
    canvas.addEventListener("webglcontextrestored", () => {
      // everything that was on the GPU is gone with it
      this.textures.clear()
      this.backdrops.clear()
      for (const entry of this.entries.values()) {
        entry.output = null
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
  }

  /** Draws `target` on every frame, until the function it returns is called */
  add(target: GlassTarget) {
    this.entries.set(target, {
      output: null,
      key: "",
      snapshot: null,
      backdrop: "",
      generation: -1,
      version: 0,
      overlay: null,
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
    if (entry.output) {
      gl.deleteFramebuffer(entry.output.fbo)
      gl.deleteTexture(entry.output.texture)
    }
    if (entry.overlay) {
      entry.overlay.disconnect()
      if (entry.overlay.texture) gl.deleteTexture(entry.overlay.texture)
    }
  }

  /** Frees the GPU copy of a picture that is no longer drawn */
  release(snapshot: Snapshot) {
    const texture = this.textures.get(snapshot)
    if (texture) this.gl.deleteTexture(texture)
    this.textures.delete(snapshot)
  }

  /** The picture on the GPU, uploaded the first time it is drawn, the way three.js did: sRGB, flipped, mipmapped */
  private texture(snapshot: Snapshot) {
    const gl = this.gl
    let texture = this.textures.get(snapshot)
    if (texture) return texture
    texture = gl.createTexture()
    const { width, height } = snapshot.canvas
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(width, height))) + 1, gl.SRGB8_ALPHA8, width, height)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, snapshot.canvas)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    this.textures.set(snapshot, texture)
    return texture
  }

  private snapshotId(snapshot: Snapshot) {
    let id = this.snapshotIds.get(snapshot)
    if (id === undefined) {
      id = this.nextSnapshotId++
      this.snapshotIds.set(snapshot, id)
    }
    return id
  }

  /** A texture of at least `width` x `height` to draw into, `current` if it is big enough. It only ever grows. */
  private target(current: Target | null, width: number, height: number, exact: boolean): Target {
    if (
      current &&
      (exact
        ? current.width === width && current.height === height
        : current.width >= width && current.height >= height)
    ) {
      return current
    }
    const gl = this.gl
    if (current) {
      gl.deleteFramebuffer(current.fbo)
      gl.deleteTexture(current.texture)
    }
    const w = exact ? width : Math.max(width, current?.width ?? 0)
    const h = exact ? height : Math.max(height, current?.height ?? 0)
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h)
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
      const resizes = new ResizeObserver(() => {
        created.stale = true
      })
      resizes.observe(el)
      created.disconnect = () => {
        mutations.disconnect()
        resizes.disconnect()
      }
      overlay = created
      entry.overlay = created
    }
    if (overlay.stale && !overlay.capturing && !this.capturing) {
      const o = overlay
      o.capturing = true
      o.stale = false
      this.capturing = true
      snapshotElement(state.element, OVERLAY_MARGIN)
        .then((canvas) => {
          o.canvas = canvas
          o.uploaded = false
          o.version++
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
   * What is behind the glass of `layer`, drawn for the region of the screen it covers, or null where none of the glass
   * below is in that region, and the glass bends the picture of the page as layer 0 does.
   */
  private backdrop(layer: number, members: Glass[], below: Glass[], scrollX: number, scrollY: number) {
    // the region: where the glass of the layer is on the screen, and as far around it as its frost reaches
    let x0 = Number.POSITIVE_INFINITY
    let y0 = Number.POSITIVE_INFINITY
    let x1 = Number.NEGATIVE_INFINITY
    let y1 = Number.NEGATIVE_INFINITY
    for (const { state } of members) {
      const reach = state.uniforms.frost + BACKDROP_MARGIN
      const cx = state.center[0] - scrollX
      const cy = state.center[1] - scrollY
      x0 = Math.min(x0, cx - state.drawn[0] / 2 - reach)
      y0 = Math.min(y0, cy - state.drawn[1] / 2 - reach)
      x1 = Math.max(x1, cx + state.drawn[0] / 2 + reach)
      y1 = Math.max(y1, cy + state.drawn[1] / 2 + reach)
    }
    const region: [number, number, number, number] = [
      Math.floor(x0),
      Math.floor(y0),
      Math.ceil(x1) - Math.floor(x0),
      Math.ceil(y1) - Math.floor(y0),
    ]
    const [rx, ry, rw, rh] = region

    // the glass below that is in it, from the bottom up: by layer, then in the order of the document
    const under = below
      .filter(({ state }) => {
        const cx = state.center[0] - scrollX
        const cy = state.center[1] - scrollY
        const hw = (state.drawn[0] * (state.width + OVERLAY_MARGIN * 2)) / state.width / 2
        const hh = (state.drawn[1] * (state.height + OVERLAY_MARGIN * 2)) / state.height / 2
        return cx + hw > rx && cx - hw < rx + rw && cy + hh > ry && cy - hh < ry + rh
      })
      .sort((a, b) => a.state.layer - b.state.layer || followsInDocument(a, b))
    if (under.length === 0) return null

    const snapshot = members[0].state.snapshot
    const overlays = under.map(({ entry, state }) => this.overlay(entry, state))
    const key = [
      region.join(" "),
      scrollX,
      scrollY,
      this.snapshotId(snapshot),
      ...under.map(({ entry, state }, i) => `${entry.version} ${state.key} ${state.center} ${overlays[i].version}`),
    ].join("|")

    const current = this.backdrops.get(layer)
    const backdrop: Backdrop = {
      ...this.target(current ?? null, rw, rh, false),
      key: current?.key ?? "",
      region,
    }
    if (current && backdrop.fbo !== current.fbo) backdrop.key = ""
    this.backdrops.set(layer, backdrop)
    if (backdrop.key === key) return backdrop
    backdrop.key = key

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
    under.forEach(({ entry, state }, i) => {
      if (!entry.output) return
      const overlay = overlays[i]
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
      gl.uniform1f(c.uniforms.uSaturate, state.saturate)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    })
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
    const output = this.target(entry.output, state.width, state.height, true)
    entry.output = output
    gl.bindFramebuffer(gl.FRAMEBUFFER, output.fbo)
    gl.viewport(0, 0, state.width, state.height)

    const program = backdrop ? this.glassOnBackdrop : this.glass
    const u = program.uniforms
    gl.useProgram(program.program)
    gl.bindVertexArray(program.vao)
    gl.activeTexture(gl.TEXTURE0)
    gl.uniform1i(u.uMap, 0)
    const g = state.uniforms
    if (backdrop) {
      // Where the center of the backdrop texture is, from the center of the glass, y up. The region is at the bottom
      // left of the texture, which only ever grows.
      const [rx, ry, , rh] = backdrop.region
      const gx = state.center[0] - scrollX
      const gy = state.center[1] - scrollY
      gl.bindTexture(gl.TEXTURE_2D, backdrop.texture)
      gl.uniform2f(u.uTexSize, backdrop.width, backdrop.height)
      gl.uniform2f(u.uBg, backdrop.width / 2 - (gx - rx), backdrop.height / 2 - (ry + rh - gy))
    } else {
      gl.bindTexture(gl.TEXTURE_2D, this.texture(state.snapshot))
      gl.uniform2f(u.uTexSize, state.snapshot.width, state.snapshot.height)
      gl.uniform2f(u.uBg, g.bg[0], g.bg[1])
    }
    gl.uniform2f(u.uSize, g.size[0], g.size[1])
    gl.uniform2f(u.uOrigin, 0, 0)
    gl.uniform1f(u.uRadius, g.radius)
    gl.uniform1f(u.uExp, g.exponent)
    gl.uniform1f(u.uBezel, g.bezel)
    gl.uniform1f(u.uShift, g.shift)
    gl.uniform1f(u.uCurve, g.curve)
    gl.uniform1f(u.uDispersion, g.dispersion)
    gl.uniform1f(u.uFrost, g.frost)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    entry.key = state.key
    entry.snapshot = state.snapshot
    entry.backdrop = backdrop?.key ?? ""
    entry.generation = this.generation
    entry.version++
  }

  private draw(time: number) {
    if (this.lost || this.gl.isContextLost()) return
    const glasses: Glass[] = []
    for (const [target, entry] of this.entries) {
      const state = target.frame(time)
      if (state && state.width > 0 && state.height > 0) glasses.push({ target, entry, state })
    }
    if (glasses.length === 0) return
    const [scrollX, scrollY] = this.scroll(time, frameScroll.x, frameScroll.y, glasses[0].state.lead)

    // from the bottom layer up: each is drawn before the ones above it, which may be drawn over it
    const drawn: Glass[] = []
    const layers = [...new Set(glasses.map(({ state }) => state.layer))].sort((a, b) => a - b)
    const below: Glass[] = []
    for (const layer of layers) {
      const members = glasses.filter(({ state }) => state.layer === layer)
      const backdrop = below.length > 0 ? this.backdrop(layer, members, below, scrollX, scrollY) : null
      for (const glass of members) {
        const { entry, state } = glass
        const same =
          entry.generation === this.generation &&
          entry.key === state.key &&
          entry.snapshot === state.snapshot &&
          entry.backdrop === (backdrop?.key ?? "")
        if (same && entry.output) continue
        this.drawGlass(glass, backdrop, scrollX, scrollY)
        drawn.push(glass)
      }
      below.push(...members)
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

    // the canvas only ever grows: resizing it is what costs, and it would happen on every frame
    const canvas = this.canvas
    if (canvas.width < width || canvas.height < height) {
      canvas.width = Math.max(canvas.width, width)
      canvas.height = Math.max(canvas.height, height)
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

/** Frees the GPU copy of a picture of the page, once nothing draws it anymore */
export function releaseSnapshot(snapshot: Snapshot) {
  renderer?.release(snapshot)
}
