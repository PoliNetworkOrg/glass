import { useEffect, useSyncExternalStore } from "react"

// Whether this device can draw the 3D glass at a frame rate worth having. Drawing it is a WebGL render
// loop with a pass of blurs and a shader per glass, which a software renderer or an old phone GPU can't keep up with, and
// the CSS glass is the better choice there. It is measured once and kept, since the answer is about the
// device and not the page.
//
// The measure doesn't run during page load, where layout, images and JIT warm-up take the frame budget
// and give false negatives. Until it has an answer glass stays on the CSS version.

const STORAGE_KEY = "polinetwork-glass:capable"
/** Bump when the measure or its threshold changes, so old verdicts are measured again */
const VERSION = 1

/** Side of the canvas the workload is drawn on, px */
const SIZE = 512
/** Loop iterations per pixel of the workload */
const ITERATIONS = 128
const WARMUP_FRAMES = 2
const SAMPLES = 8
/** A frame of the workload slower than this (the median of the samples), in ms, is too slow */
const MAX_MEDIAN_MS = 8
const IDLE_TIMEOUT_MS = 3000

const store = {
  get() {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  },
  set(value: string) {
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      /* private mode or no room, it is measured again next time */
    }
  },
}

function readCache(): boolean | null {
  try {
    const parsed = JSON.parse(store.get() ?? "null")
    return parsed?.version === VERSION ? Boolean(parsed.capable) : null
  } catch {
    return null
  }
}

let verdict: boolean | null = typeof window === "undefined" ? null : readCache()
let started = false
const listeners = new Set<() => void>()

function setVerdict(capable: boolean) {
  verdict = capable
  store.set(JSON.stringify({ version: VERSION, capable }))
  for (const listener of listeners) listener()
}

const VERTEX = `#version 300 es
void main() {
  // a triangle that covers the canvas
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

// Something with the shape of what the glass does for each pixel: a loop of trigonometry and a mix of the results
const FRAGMENT = `#version 300 es
precision highp float;
out vec4 color;
void main() {
  vec2 p = gl_FragCoord.xy / ${SIZE}.0;
  float a = 0.0;
  for (int i = 0; i < ${ITERATIONS}; i++) {
    float f = float(i);
    a += sin(p.x * f + a) * cos(p.y * f - a) / (1.0 + f * 0.05);
  }
  color = vec4(vec3(0.5 + 0.5 * a), 1.0);
}`

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
}

/**
 * Measures the device.
 *
 * First it asks for a WebGL2 context that fails if it would be a software renderer, which is the answer
 * without having to time anything. Then it times a workload with the shape of the glass, and the device
 * is capable if the median of its frames is fast enough.
 *
 * @returns true if the device can draw the 3D glass well
 */
export function measureCapability(): boolean {
  const canvas = document.createElement("canvas")
  canvas.width = SIZE
  canvas.height = SIZE
  const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true, antialias: false })
  if (!gl) return false

  try {
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    const program = gl.createProgram()
    if (!vs || !fs || !program) return false
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false
    gl.useProgram(program)
    gl.viewport(0, 0, SIZE, SIZE)

    const pixel = new Uint8Array(4)
    const frame = () => {
      const start = performance.now()
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      // reading a pixel is what makes the GPU finish, and so what makes the time mean something
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
      return performance.now() - start
    }

    for (let i = 0; i < WARMUP_FRAMES; i++) frame()
    const times = Array.from({ length: SAMPLES }, frame).sort((a, b) => a - b)
    return times[Math.floor(SAMPLES / 2)] <= MAX_MEDIAN_MS
  } finally {
    gl.getExtension("WEBGL_lose_context")?.loseContext()
  }
}

/** Measures the device once, when the browser is idle, unless it already has an answer */
function start() {
  if (started || verdict !== null || typeof window === "undefined") return
  started = true
  const run = () => setVerdict(measureCapability())
  if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS })
  else setTimeout(run, IDLE_TIMEOUT_MS)
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * # useGlassCapability
 * Whether the device can draw the 3D glass well. It is measured the first time glass is used
 * and then remembered.
 *
 * @returns null while it is not known yet, and then true or false
 */
export function useGlassCapability(): boolean | null {
  useEffect(start, [])
  return useSyncExternalStore(
    subscribe,
    () => verdict,
    () => null
  )
}
