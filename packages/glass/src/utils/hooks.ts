import { useMotionValue } from "motion/react"
import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { RectReadOnly } from "react-use-measure"
import type { Texture } from "three"
import { getTexture } from "./texture"

/**
 * React hook to handle async initializers
 * @param asyncfn Async initializer function, this only gets called once
 * @returns null while the promise is not yet resolved (or has rejected), and T once fullfilled
 */
export function useAwait<T>(asyncfn: () => Promise<T>): T | null {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    void asyncfn()
      .then(setData)
      .catch(() => setData(null))
  }, [])
  return data
}

/** How long the page has to stay the same size before it is captured again, so a resize is captured once at its end */
const RESIZE_SETTLE_MS = 150

/**
 *  # useBackgroundTexture
 * React hook to load and update the background texture based on the document element.
 *
 * The page is captured again when `deps` or `blur` change, when it changes size (once it settles), and when an
 * image or a font finishes loading, since the capture before it was taken without them.
 *
 * ### Note
 * One capture runs at a time: whatever asks for one while it runs gets a single capture after it, since capturing
 * the page is the expensive part.
 *
 * @param deps The dependency array for the texture to be considered invalid, passed to {@link useEffect}
 * @param blur Blur amount for the texture
 * @param enabled When false nothing is captured, which is the expensive part, and there is no texture
 * @returns The current background texture, or null if not yet loaded
 */
export function useBackgroundTexture(deps: unknown[] = [], blur: number = 0, enabled: boolean = true): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null)
  const blurRef = useRef(blur)
  blurRef.current = blur

  const capturer = useMemo(() => {
    const state = {
      on: false,
      running: false,
      /** Something asked for a capture while one was running */
      again: false,
      /** The size of the page when it was last captured: a ResizeObserver reports it once when it starts, as a change */
      size: "",
    }
    let timer: ReturnType<typeof setTimeout> | undefined

    const run = async () => {
      if (state.running) {
        state.again = true
        return
      }
      state.running = true
      do {
        state.again = false
        state.size = pageSize()
        try {
          const next = await getTexture(blurRef.current)
          // a capture that was overtaken, or that ended after the texture was turned off, is thrown away
          if (state.on && !state.again) setTexture(next)
          else next.dispose()
        } catch {
          /* the page couldn't be drawn, the glass keeps the texture it had */
        }
      } while (state.again && state.on)
      state.running = false
    }

    return {
      /** Captures the page after `ms`, or after the last of the calls that come in the meantime */
      schedule(ms = 0) {
        if (!state.on) return
        clearTimeout(timer)
        timer = setTimeout(() => void run(), ms)
      },
      resized() {
        if (pageSize() !== state.size) this.schedule(RESIZE_SETTLE_MS)
      },
      start() {
        state.on = true
        this.schedule()
      },
      stop() {
        state.on = false
        clearTimeout(timer)
        state.size = ""
      },
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setTexture(null)
      return
    }
    capturer.start()
    const observer = new ResizeObserver(() => capturer.resized())
    observer.observe(document.documentElement)
    // a load event doesn't bubble, but it can be caught on its way down
    const loaded = (e: Event) => {
      if (e.target instanceof HTMLImageElement) capturer.schedule(RESIZE_SETTLE_MS)
    }
    const fontsLoaded = () => capturer.schedule(RESIZE_SETTLE_MS)
    document.addEventListener("load", loaded, true)
    document.fonts.addEventListener("loadingdone", fontsLoaded)
    return () => {
      capturer.stop()
      observer.disconnect()
      document.removeEventListener("load", loaded, true)
      document.fonts.removeEventListener("loadingdone", fontsLoaded)
    }
  }, [capturer, enabled])

  useEffect(() => capturer.schedule(), [capturer, blur, ...deps])

  // a texture is the whole page, so the one that was replaced has to be freed, or each capture leaves one on the GPU
  useEffect(() => () => texture?.dispose(), [texture])

  return texture
}

const pageSize = () => `${document.documentElement.scrollWidth}x${document.documentElement.scrollHeight}`

type Watcher = () => (() => void) | undefined

const watchers = new Set<Watcher>()
const drawers = new Set<() => void>()
let frame = 0

/**
 * Where the page is scrolled, read once at the start of each frame for every glass. It is read from the window and not
 * from scroll events: where the page is pulled past its end (an overscroll) it can change without one.
 */
export const frameScroll = { x: 0, y: 0 }

function tick() {
  frame = requestAnimationFrame(tick)
  frameScroll.x = window.scrollX
  frameScroll.y = window.scrollY
  // everything is read before anything is written, so a glass that redraws doesn't force a layout for the next one
  const commits: (() => void)[] = []
  for (const read of watchers) {
    const commit = read()
    if (commit) commits.push(commit)
  }
  for (const commit of commits) commit()
  // and drawn in the same frame, from what was just read: a glass drawn on the next one would be a frame behind
  for (const draw of drawers) draw()
}

function startLoop() {
  if (!frame) frame = requestAnimationFrame(tick)
}

function stopLoopIfIdle() {
  if (watchers.size === 0 && drawers.size === 0) {
    cancelAnimationFrame(frame)
    frame = 0
  }
}

/**
 * Calls `read` on every frame, and the function it returns, if it does, after all the other watchers have read.
 * All of them share one animation frame loop, which only runs while there is one.
 */
function watchFrames(read: Watcher) {
  watchers.add(read)
  startLoop()
  return () => {
    watchers.delete(read)
    stopLoopIfIdle()
  }
}

/**
 * Calls `draw` on every frame, after every watcher has read and committed, so it draws where the page and the
 * elements are in this frame. It shares the loop of {@link watchFrames}.
 */
export function drawFrames(draw: () => void) {
  drawers.add(draw)
  startLoop()
  return () => {
    drawers.delete(draw)
    stopLoopIfIdle()
  }
}

/**
 * The rectangle of an element as it is drawn (transforms included), and the size of its box before them: the
 * canvas of a glass has the second and draws the first.
 */
export type GlassBounds = RectReadOnly & { layoutWidth: number; layoutHeight: number }

const boundsOf = (rect: DOMRect, layoutWidth: number, layoutHeight: number): GlassBounds => ({
  x: rect.x,
  y: rect.y,
  width: rect.width,
  height: rect.height,
  top: rect.top,
  right: rect.right,
  bottom: rect.bottom,
  left: rect.left,
  layoutWidth,
  layoutHeight,
})

const sameRect = (a: RectReadOnly, b: DOMRect) =>
  Math.abs(a.x - b.x) < 0.01 &&
  Math.abs(a.y - b.y) < 0.01 &&
  Math.abs(a.width - b.width) < 0.01 &&
  Math.abs(a.height - b.height) < 0.01

/**
 * # useMotionBounds
 * Custom hook to track the bounding rectangle of a DOM element using motion values.
 *
 * Having the bounds as motion values allows for smooth animations without constant re-renders.
 *
 * It accounts for visual viewport offsets and updates on resize and scroll events. The rectangle is where the
 * element is drawn, transforms included, and a transform (a press, a transition, an animation) fires none of those
 * events, so while `watch` is true the rectangle is read on every frame instead, and only changes when it moved.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport
 *
 * _The DOM is the biggest threat to performance yet again_
 *
 * @param watch Read the rectangle on every frame. Costs a read of it per frame, so only for what is being drawn.
 * @return A tuple containing:
 *   - A ref to be attached to the target DOM element.
 *   - A MotionValue representing the bounding rectangle of the element.
 */
export function useMotionBounds(watch = false) {
  const motionValues = useMotionValue<GlassBounds>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    layoutWidth: 0,
    layoutHeight: 0,
  })
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const updatePosition = () => {
      if (ref.current) {
        motionValues.set(
          boundsOf(ref.current.getBoundingClientRect(), ref.current.offsetWidth, ref.current.offsetHeight)
        )
      }
    }
    updatePosition()
    // while it is watched every frame reads it, and the events would only read it again
    if (watch) return

    // everything that counld change the element's position or size
    const observer = new ResizeObserver(updatePosition)
    if (ref.current) {
      observer.observe(ref.current)
      observer.observe(document.documentElement)
      window.addEventListener("scroll", updatePosition, { passive: true })
      window.addEventListener("resize", updatePosition, { passive: true })
      window.visualViewport?.addEventListener("scroll", updatePosition, { passive: true })
      window.visualViewport?.addEventListener("resize", updatePosition, { passive: true })
    }

    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", updatePosition)
      window.removeEventListener("resize", updatePosition)
      window.visualViewport?.removeEventListener("scroll", updatePosition)
      window.visualViewport?.removeEventListener("resize", updatePosition)
    }
  }, [ref.current, watch])

  useEffect(() => {
    if (!watch) return
    return watchFrames(() => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (sameRect(motionValues.get(), rect)) return
      const bounds = boundsOf(rect, el.offsetWidth, el.offsetHeight)
      return () => motionValues.set(bounds)
    })
  }, [watch, motionValues])

  return [ref, motionValues] as const
}

/**
 * # useReducedMotion
 * Simple hook to detect if the user has requested increased contrast.
 *
 * @returns true if the user has set a preference for increased contrast
 */
export function useIncreasedContrast() {
  const [increasedContrast, setIncreasedContrast] = useState(false)

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-contrast: more)")
    setIncreasedContrast(mq.matches)

    const handleChange = (event: MediaQueryListEvent) => {
      setIncreasedContrast(event.matches)
    }

    mq.addEventListener("change", handleChange)
    return () => {
      mq.removeEventListener("change", handleChange)
    }
  }, [])

  return increasedContrast
}

/**
 * # useComputedStyle
 *
 * React hook to compute a value based on the computed style of a DOM element.
 *
 * @param transform callback function to create a value from the computed style of the element
 * @returns a tuple, with a ref for the element whose style needs to be referenced and the transformed value
 */
export function useComputedStyle<T extends HTMLElement, R>(transform: (style: CSSStyleDeclaration) => R) {
  const ref = useRef<T | null>(null)
  const [computed, setComputed] = useState<R | null>(null)

  useLayoutEffect(() => {
    if (ref.current) {
      const style = window.getComputedStyle(ref.current)
      const result = transform(style)
      setComputed(result)
    }
  }, [ref.current])

  return [ref, computed] as const
}

/**
 * # useInView
 * Tells whether an element is on the screen, or about to be.
 *
 * Each 3D glass is a WebGL context and a render loop, so glass that is far off screen
 * shouldn't have one. It starts as not in view, so nothing is built before it is seen.
 *
 * @param ref The element to watch
 * @param rootMargin How far past the screen counts as in view, to be ready before a scroll gets there
 * @returns true while the element is within the margin of the screen
 */
export function useInView(ref: RefObject<Element | null>, rootMargin = "200px") {
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (typeof IntersectionObserver === "undefined") {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        // the last entry is where the element stands now
        const entry = entries[entries.length - 1]
        if (entry) setInView(entry.isIntersecting)
      },
      { rootMargin }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, rootMargin])

  return inView
}
