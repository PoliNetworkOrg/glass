import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

// Measures, on the device, how often the page learns where it is scrolled, and whether a canvas drawn in a worker reaches
// the screen more often than the animation frames do, to see what the ideas of
// https://rida.dev/blog/bypassing-ios-safari-60-fps-limit would be worth for the glass on an iPhone:
//
//   - per frame: what the glass sees now, reading the scroll in requestAnimationFrame (60 a second on iOS, by default)
//   - in a tight loop: the scroll read every 2ms from a MessageChannel and a timer while the page moves, which says
//     whether the page could hear of the scroll more often than once a frame
//   - while the toolbar moves: Safari is said to report the scroll 10 times a second while the URL bar resizes, which
//     the glass would read as stops (the predictor takes 50ms without news for one)
//   - the scroll keepalive of the glass (a scroll-driven animation, see frames.ts) can be turned off here, to compare
//   - touch moves: how often a finger is heard of
//   - the bars: the same bar moved by the animation frames of the page, by those of a worker, and by a timer in a worker,
//     each on its own canvas, the last two handed to the worker (transferControlToOffscreen). Watched while a finger
//     moves the page, so the display runs at its fastest, a bar drawn more often moves visibly smoother
//
// The counters are numbers only, and nothing is made in the loops: what is measured is Safari, not its collector.

/** A wait longer than this between two positions is the page standing still, not a slow report, in ms */
const END = 300
/** A wait longer than this is what the predictor of the glass takes for a stop, in ms (`STILL` in predict.ts) */
const STILL = 50
/** How often the tight loop reads the scroll, in ms */
const TIGHT = 2

/** The changes of one reading of the scroll, counted while the page moves */
class Changes {
  count = 0
  /** How long the page moved, in ms: the waits between changes, those short enough to be one movement */
  time = 0
  /** The longest of those waits */
  gap = 0
  /** How many of them were longer than {@link STILL} */
  stops = 0
  private last = 0
  private x = Number.NaN
  private y = Number.NaN

  /** Sees where the page is at `t`, and returns how long it waited for this change, or -1 if it isn't one */
  see(t: number, x: number, y: number) {
    if (x === this.x && y === this.y) return -1
    const first = Number.isNaN(this.x)
    this.x = x
    this.y = y
    const wait = t - this.last
    this.last = t
    if (first || wait >= END) return -1
    this.count++
    this.time += wait
    if (wait > this.gap) this.gap = wait
    if (wait > STILL) this.stops++
    return wait
  }

  rate() {
    return this.time > 0 ? (this.count * 1000) / this.time : 0
  }

  reset() {
    this.count = this.time = this.gap = this.stops = 0
  }
}

/** Events of one kind (touch moves), counted while they come one after another */
class Events {
  count = 0
  time = 0
  private last = 0

  see(t: number) {
    const wait = t - this.last
    this.last = t
    if (wait >= END) return
    this.count++
    this.time += wait
  }

  rate() {
    return this.time > 0 ? (this.count * 1000) / this.time : 0
  }

  reset() {
    this.count = this.time = 0
  }
}

const perFrame = new Changes()
const tight = new Changes()
/** The changes seen per frame while the toolbar moved, or just before */
const toolbar = { count: 0, time: 0, gap: 0 }
const touches = new Events()

export type LabStats = {
  perFrame: number
  tight: number
  gap: number
  stops: number
  toolbar: number
  toolbarGap: number
  toolbarSeen: boolean
  touch: number
}

const read = (): LabStats => ({
  perFrame: perFrame.rate(),
  tight: tight.rate(),
  gap: perFrame.gap,
  stops: perFrame.stops,
  toolbar: toolbar.time > 0 ? (toolbar.count * 1000) / toolbar.time : 0,
  toolbarGap: toolbar.gap,
  toolbarSeen: toolbar.count > 0,
  touch: touches.rate(),
})

function resetLab() {
  perFrame.reset()
  tight.reset()
  toolbar.count = toolbar.time = toolbar.gap = 0
  touches.reset()
}

/** Starts the probes, and returns what stops them */
function startLab() {
  let frame = 0
  let height = window.innerHeight
  let viewport = window.visualViewport?.height ?? 0
  /** When the toolbar last moved (the viewport changed height) */
  let toolbarAt = Number.NEGATIVE_INFINITY
  const markToolbar = () => {
    toolbarAt = performance.now()
  }

  const tick = (t: number) => {
    frame = requestAnimationFrame(tick)
    const h = window.innerHeight
    const v = window.visualViewport?.height ?? 0
    if (h !== height || v !== viewport) {
      height = h
      viewport = v
      toolbarAt = t
    }
    const wait = perFrame.see(t, window.scrollX, window.scrollY)
    // the wait that ended here had the toolbar moving in it
    if (wait >= 0 && t - toolbarAt < wait + 34) {
      toolbar.count++
      toolbar.time += wait
      if (wait > toolbar.gap) toolbar.gap = wait
    }
  }
  frame = requestAnimationFrame(tick)

  // The tight loop runs only while the page moves or a finger is on it: a message for a task of its own, then a timer,
  // so it reads every 2ms without keeping a core busy
  const channel = new MessageChannel()
  // in an object, which the listeners below change: a plain `let` reads to the linter as one only this function sets
  const loop = { running: false, until: 0, touching: false }
  const post = () => channel.port2.postMessage(0)
  channel.port1.onmessage = () => {
    const t = performance.now()
    if (tight.see(t, window.scrollX, window.scrollY) >= 0) loop.until = t + 500
    if (loop.touching || t < loop.until) setTimeout(post, TIGHT)
    else loop.running = false
  }
  const kick = () => {
    loop.until = performance.now() + 500
    if (!loop.running) {
      loop.running = true
      post()
    }
  }

  const onScroll = () => kick()
  const onTouchStart = () => {
    loop.touching = true
    kick()
  }
  const onTouchMove = (e: TouchEvent) => touches.see(e.timeStamp)
  const onTouchEnd = (e: TouchEvent) => {
    loop.touching = e.touches.length > 0
  }
  const opts = { passive: true, capture: true }
  window.addEventListener("scroll", onScroll, opts)
  window.addEventListener("touchstart", onTouchStart, opts)
  window.addEventListener("touchmove", onTouchMove, opts)
  window.addEventListener("touchend", onTouchEnd, opts)
  window.addEventListener("touchcancel", onTouchEnd, opts)
  window.visualViewport?.addEventListener("resize", markToolbar)

  return () => {
    cancelAnimationFrame(frame)
    loop.touching = false
    loop.until = 0
    channel.port1.close()
    window.removeEventListener("scroll", onScroll, opts)
    window.removeEventListener("touchstart", onTouchStart, opts)
    window.removeEventListener("touchmove", onTouchMove, opts)
    window.removeEventListener("touchend", onTouchEnd, opts)
    window.removeEventListener("touchcancel", onTouchEnd, opts)
    window.visualViewport?.removeEventListener("resize", markToolbar)
  }
}

function useLabStats(on: boolean) {
  const [stats, setStats] = useState<LabStats>(read)
  useEffect(() => {
    if (!on) return
    resetLab()
    const stop = startLab()
    const timer = setInterval(() => setStats(read()), 500)
    return () => {
      stop()
      clearInterval(timer)
    }
  }, [on])
  return stats
}

/** How long a bar takes to cross its canvas, in ms: fast, so that 60 and 120 a second look different */
const CROSS = 700
const BAR = 14
const BAR_COLOR = "#0ea5e9"

/** Where a bar `bar` wide is at `time` (from the clock both share, `timeOrigin` + `now()`), on a canvas `width` wide */
const barX = (time: number, width: number, bar: number) => {
  const u = (time % (2 * CROSS)) / CROSS
  return (u < 1 ? u : 2 - u) * (width - bar)
}

// The worker draws the same bar as the page, from the same clock, on the two canvases it is handed: one on its own
// animation frames, where it has them, and one on a timer at 120 a second, kept in step with the clock
const WORKER = `
const CROSS = ${CROSS}, BAR = ${BAR}, COLOR = "${BAR_COLOR}", PERIOD = 1000 / 120
// the same as barX in the page, written out: the page's own would be renamed by the minifier
const barX = (time, width, bar) => {
  const u = (time % (2 * CROSS)) / CROSS
  return (u < 1 ? u : 2 - u) * (width - bar)
}
let rafCtx, timerCtx, w, h, bar, stopped = false
let rafCount = 0, timerCount = 0, since = 0
const hasRaf = typeof self.requestAnimationFrame === "function"
const paint = (ctx) => {
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = COLOR
  ctx.fillRect(barX(performance.timeOrigin + performance.now(), w, bar), 0, bar, h)
}
const report = () => {
  const now = performance.now()
  if (now - since < 1000) return
  self.postMessage({ raf: hasRaf ? (rafCount * 1000) / (now - since) : -1, timer: (timerCount * 1000) / (now - since) })
  rafCount = timerCount = 0
  since = now
}
const raf = () => {
  if (stopped) return
  rafCount++
  paint(rafCtx)
  report()
  self.requestAnimationFrame(raf)
}
// which 120th of a second was last drawn: one draw in each, so a timer that fires early doesn't draw one twice
let slot = -1
const timer = () => {
  if (stopped) return
  const now = performance.timeOrigin + performance.now()
  const current = Math.floor(now / PERIOD)
  if (current !== slot) {
    slot = current
    timerCount++
    paint(timerCtx)
    report()
  }
  setTimeout(timer, (current + 1) * PERIOD - now)
}
self.onmessage = (e) => {
  const d = e.data
  if (d.stop) {
    stopped = true
    return
  }
  w = d.width
  h = d.height
  bar = BAR * d.dpr
  d.raf.width = d.timer.width = w
  d.raf.height = d.timer.height = h
  rafCtx = d.raf.getContext("2d")
  timerCtx = d.timer.getContext("2d")
  since = performance.now()
  if (hasRaf) self.requestAnimationFrame(raf)
  timer()
}
`

/** The three bars, and how often the worker draws its two */
function Bars() {
  const pageRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<HTMLDivElement>(null)
  const [rates, setRates] = useState<{ raf: number; timer: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const page = pageRef.current
    const rafSlot = rafRef.current
    const timerSlot = timerRef.current
    if (!page || !rafSlot || !timerSlot) return
    // The worker's canvases are made here, new each time: a canvas is handed to a worker only once, and in development
    // React runs this twice
    const rafCanvas = document.createElement("canvas")
    const timerCanvas = document.createElement("canvas")
    for (const c of [rafCanvas, timerCanvas]) c.className = "block h-full w-full"
    rafSlot.append(rafCanvas)
    timerSlot.append(timerCanvas)
    const dpr = window.devicePixelRatio || 1
    const width = Math.round(page.clientWidth * dpr)
    const height = Math.round(page.clientHeight * dpr)
    page.width = width
    page.height = height
    const ctx = page.getContext("2d")
    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      if (!ctx) return
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = BAR_COLOR
      ctx.fillRect(barX(performance.timeOrigin + performance.now(), width, BAR * dpr), 0, BAR * dpr, height)
    }
    frame = requestAnimationFrame(tick)

    const made: { worker: Worker | null; url: string } = { worker: null, url: "" }
    if (!("transferControlToOffscreen" in rafCanvas)) setError("No transferControlToOffscreen here")
    else {
      try {
        made.url = URL.createObjectURL(new Blob([WORKER], { type: "text/javascript" }))
        const worker = new Worker(made.url)
        made.worker = worker
        worker.onmessage = (e) => setRates(e.data)
        worker.onerror = (e) => setError(e.message || "The worker failed")
        const raf = rafCanvas.transferControlToOffscreen()
        const timer = timerCanvas.transferControlToOffscreen()
        worker.postMessage({ raf, timer, width, height, dpr }, [raf, timer])
      } catch (e) {
        setError(String(e))
      }
    }
    return () => {
      cancelAnimationFrame(frame)
      made.worker?.postMessage({ stop: true })
      made.worker?.terminate()
      if (made.url) URL.revokeObjectURL(made.url)
      rafCanvas.remove()
      timerCanvas.remove()
    }
  }, [])

  const row = "h-3.5 w-full rounded-sm bg-black/5 dark:bg-white/10"
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs opacity-60">Page, frames</span>
      <canvas ref={pageRef} className={row} />
      <span className="text-xs opacity-60">
        Worker, frames{rates ? ` · ${rates.raf < 0 ? "none here" : `${Math.round(rates.raf)}/s`}` : ""}
      </span>
      <div ref={rafRef} className={row} />
      <span className="text-xs opacity-60">Worker, 120/s timer{rates ? ` · ${Math.round(rates.timer)}/s` : ""}</span>
      <div ref={timerRef} className={row} />
      {error && <span className="text-xs text-amber-600">{error}</span>}
    </div>
  )
}

const Stat = ({ label, value, warn }: { label: string; value: string; warn?: boolean }) => (
  <div className="flex items-baseline justify-between gap-2">
    <dt className="text-xs opacity-60">{label}</dt>
    <dd className={cn("font-mono text-xs tabular-nums", warn && "text-amber-600")}>{value}</dd>
  </div>
)

/** The probes, their numbers, and the switches for the two experiments, while `on` */
export function FrameLab({
  on,
  onChange,
  keepalive,
  onKeepaliveChange,
}: {
  on: boolean
  onChange: (on: boolean) => void
  /** The scroll-driven animation the glass keeps running (`scrollKeepalive` of the provider) */
  keepalive: boolean
  onKeepaliveChange: (on: boolean) => void
}) {
  const [bars, setBars] = useState(false)
  const stats = useLabStats(on)
  const n = (x: number) => (x > 0 ? `${Math.round(x)}/s` : "–")

  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-center justify-between gap-2">
        <span>
          Frame lab
          <span className="block text-xs opacity-60">How often the page hears of its scroll</span>
        </span>
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 accent-sky-500"
        />
      </label>
      {on && (
        <>
          <dl className="flex flex-col gap-1">
            <Stat label="Scroll per frame" value={n(stats.perFrame)} />
            <Stat label="Scroll, tight loop" value={n(stats.tight)} />
            <Stat label="Longest wait" value={stats.gap > 0 ? `${Math.round(stats.gap)} ms` : "–"} />
            <Stat label="Waits over 50ms" value={String(stats.stops)} warn={stats.stops > 0} />
            <Stat
              label="Toolbar moving"
              value={stats.toolbarSeen ? `${n(stats.toolbar)} · ${Math.round(stats.toolbarGap)} ms` : "not seen yet"}
              warn={stats.toolbarGap > STILL}
            />
            <Stat label="Touch moves" value={n(stats.touch)} />
          </dl>
          <button
            type="button"
            onClick={() => resetLab()}
            className="self-start rounded-full bg-black/5 px-3 py-1 text-xs dark:bg-white/10"
          >
            Reset
          </button>
          <label className="flex cursor-pointer items-center justify-between gap-2">
            <span>
              Scroll keepalive
              <span className="block text-xs opacity-60">
                The glass's scroll-driven animation, on touch devices only
              </span>
            </span>
            <input
              type="checkbox"
              checked={keepalive}
              onChange={(e) => {
                onKeepaliveChange(e.target.checked)
                resetLab()
              }}
              className="size-4 accent-sky-500"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-2">
            <span>
              120Hz bars
              <span className="block text-xs opacity-60">Watch them while a finger moves the page</span>
            </span>
            <input
              type="checkbox"
              checked={bars}
              onChange={(e) => setBars(e.target.checked)}
              className="size-4 accent-sky-500"
            />
          </label>
          {bars && <Bars />}
        </>
      )}
    </div>
  )
}
