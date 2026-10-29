import { drawFrames } from "../utils/frames"
import type { Snapshot } from "../utils/snapshot"
import { FRAGMENT, type GlassUniforms, QUAD, VERTEX } from "./displacement"

// One WebGL context draws every glass on the page.
//
// A context per glass held a copy of the picture of the page each (WebGL contexts share nothing), uploaded it again on
// every capture, and ran into the browser's cap on contexts: Chrome keeps 16 and drops the oldest, whose glass goes
// blank. Here the picture is on the GPU once, and each frame the glasses that changed are drawn side by side on one
// canvas, which is taken as one bitmap and copied, a piece to each, to the 2D canvas the glass shows. It is one bitmap
// and not a copy from the canvas per glass because Firefox reads a WebGL canvas back to the CPU on every copy: 137ms a
// frame for 16 glasses, against 12ms for one bitmap and its pieces. In Chrome either is a fraction of a ms.

/** What a glass asks to have drawn on a frame */
export type GlassDraw = {
  snapshot: Snapshot
  /** The size of the box of the element, which is the size of its canvas, in px */
  width: number
  height: number
  uniforms: GlassUniforms
}

export type GlassTarget = {
  /** The canvas the glass is shown on */
  canvas: HTMLCanvasElement
  /**
   * Called on every frame: what to draw, or null where nothing changed since what it drew last. `force` is set when
   * what it drew is gone (the GPU context was lost and has come back).
   */
  frame: (time: number, force: boolean) => GlassDraw | null
}

/** How wide the canvas the glasses are drawn on is let to grow before they are put on more rows */
const ROW_WIDTH = 2048

type Program = {
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  uniforms: Record<string, WebGLUniformLocation | null>
}

const UNIFORMS = [
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
] as const

function compile(gl: WebGL2RenderingContext): Program {
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)
    if (!s) throw new Error("glass: no shader")
    gl.shaderSource(s, source)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`glass: ${gl.getShaderInfoLog(s)}`)
    return s
  }
  const program = gl.createProgram()
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX))
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT))
  gl.bindAttribLocation(program, 0, "aPos")
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`glass: ${gl.getProgramInfoLog(program)}`)

  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  const uniforms = Object.fromEntries(UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)]))
  return { program, vao, uniforms }
}

class GlassRenderer {
  private readonly canvas: OffscreenCanvas | HTMLCanvasElement
  private readonly gl: WebGL2RenderingContext
  private program: Program
  private readonly textures = new Map<Snapshot, WebGLTexture>()
  private readonly targets = new Set<GlassTarget>()
  private readonly contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D | null>()
  private stop: (() => void) | null = null
  private lost = false
  /** Counts the times the context came back, so the glasses know to draw again */
  private generation = 0
  private readonly drawnIn = new WeakMap<GlassTarget, number>()

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
    this.program = compile(gl)

    const canvas = this.canvas as EventTarget
    canvas.addEventListener("webglcontextlost", (e) => {
      // so that it can come back
      e.preventDefault()
      this.lost = true
    })
    canvas.addEventListener("webglcontextrestored", () => {
      // everything that was on the GPU is gone with it
      this.textures.clear()
      this.program = compile(this.gl)
      this.lost = false
      this.generation++
    })
  }

  /** Draws `target` on every frame, until the function it returns is called */
  add(target: GlassTarget) {
    this.targets.add(target)
    this.stop ??= drawFrames((time) => this.draw(time))
    return () => {
      this.targets.delete(target)
      if (this.targets.size === 0) {
        this.stop?.()
        this.stop = null
      }
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

  private draw(time: number) {
    if (this.lost || this.gl.isContextLost()) return
    const jobs: [GlassTarget, GlassDraw][] = []
    for (const target of this.targets) {
      const force = this.drawnIn.get(target) !== this.generation
      const job = target.frame(time, force)
      if (job && job.width > 0 && job.height > 0) jobs.push([target, job])
    }
    if (jobs.length === 0) return

    // the glasses side by side, in rows, from the top left
    const slots: [number, number][] = []
    const rowWidth = Math.max(ROW_WIDTH, ...jobs.map(([, job]) => job.width))
    let x = 0
    let y = 0
    let rowHeight = 0
    let width = 0
    for (const [, job] of jobs) {
      if (x > 0 && x + job.width > rowWidth) {
        y += rowHeight
        x = 0
        rowHeight = 0
      }
      slots.push([x, y])
      x += job.width
      rowHeight = Math.max(rowHeight, job.height)
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
    const { program, vao, uniforms: u } = this.program
    gl.useProgram(program)
    gl.bindVertexArray(vao)
    gl.activeTexture(gl.TEXTURE0)
    gl.uniform1i(u.uMap, 0)
    jobs.forEach(([, job], i) => {
      const [sx, sy] = slots[i]
      // GL counts rows from the bottom of the canvas
      const glY = canvas.height - sy - job.height
      const g = job.uniforms
      gl.viewport(sx, glY, job.width, job.height)
      gl.bindTexture(gl.TEXTURE_2D, this.texture(job.snapshot))
      gl.uniform2f(u.uTexSize, job.snapshot.width, job.snapshot.height)
      gl.uniform2f(u.uBg, g.bg[0], g.bg[1])
      gl.uniform2f(u.uSize, g.size[0], g.size[1])
      gl.uniform2f(u.uOrigin, sx, glY)
      gl.uniform1f(u.uRadius, g.radius)
      gl.uniform1f(u.uExp, g.exponent)
      gl.uniform1f(u.uBezel, g.bezel)
      gl.uniform1f(u.uShift, g.shift)
      gl.uniform1f(u.uCurve, g.curve)
      gl.uniform1f(u.uDispersion, g.dispersion)
      gl.uniform1f(u.uFrost, g.frost)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    })

    const source = "transferToImageBitmap" in canvas ? canvas.transferToImageBitmap() : canvas
    jobs.forEach(([target, job], i) => {
      const [sx, sy] = slots[i]
      const out = target.canvas
      // resizing a canvas clears it, and it is drawn right after
      if (out.width !== job.width || out.height !== job.height) {
        out.width = job.width
        out.height = job.height
      }
      let ctx = this.contexts.get(out)
      if (ctx === undefined) {
        ctx = out.getContext("2d")
        this.contexts.set(out, ctx)
      }
      ctx?.drawImage(source, sx, sy, job.width, job.height, 0, 0, job.width, job.height)
      this.drawnIn.set(target, this.generation)
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
