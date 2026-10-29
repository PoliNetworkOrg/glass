import { useMotionValue } from "motion/react"
import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { releaseSnapshot } from "../3D/renderer"
import { watchFrames } from "./frames"
import { type Snapshot, snapshot } from "./snapshot"

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

/** How long after a capture with new images it is taken again, see `fresh` of the snapshot */
const RETAKE_MS = 400
/** How long to wait after an image or a font loads before capturing, so a burst of them is captured once */
const LOAD_SETTLE_MS = 150

/**
 * Resolves after the next frame has been drawn. Almost every step of a capture resolves as a microtask, so captures
 * taken one after the other would never let the page draw a frame: there is one between them, which keeps a resize
 * at full frame rate with a capture on most frames.
 */
const afterNextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))

/**
 *  # usePageSnapshot
 * React hook to capture the page, and capture it again when it changes.
 *
 * The page is captured again when `deps` or `blur` change, when it changes size, and when an image or a font
 * finishes loading, since the capture before it was taken without them.
 *
 * ### Note
 * One capture runs at a time: whatever asks for one while it runs gets a single capture after it, a frame later. So
 * while the page keeps changing (a window being resized) it is captured about once a frame, and each one is shown,
 * since it is newer than the one on screen.
 *
 * @param deps The dependency array for the picture to be considered out of date, passed to {@link useEffect}
 * @param blur Blur amount for the picture
 * @param enabled When false nothing is captured, which is the expensive part, and there is no picture
 * @returns The current picture of the page, or null if not yet captured
 */
export function usePageSnapshot(deps: unknown[] = [], blur: number = 0, enabled: boolean = true): Snapshot | null {
  const [picture, setPicture] = useState<Snapshot | null>(null)
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

    /** Captures the page after `ms`, or after the last of the calls that come in the meantime */
    const schedule = (ms = 0) => {
      if (!state.on) return
      clearTimeout(timer)
      timer = setTimeout(() => void run(), ms)
    }

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
          const next = await snapshot(blurRef.current)
          // a capture that ended after the glass was turned off is thrown away
          if (state.on) setPicture(next)
          else releaseSnapshot(next)
          // one with an image no capture had before is taken again, in case WebKit drew it before decoding it, and
          // one where an image failed to load, to ask for it again
          if (next.fresh) schedule(RETAKE_MS)
        } catch {
          /* the page couldn't be drawn, the glass keeps the picture it had */
        }
        if (state.again) await afterNextFrame()
      } while (state.again && state.on)
      state.running = false
    }

    return {
      schedule,
      resized() {
        if (pageSize() !== state.size) schedule()
      },
      start() {
        state.on = true
        schedule()
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
      setPicture(null)
      return
    }
    capturer.start()
    const observer = new ResizeObserver(() => capturer.resized())
    observer.observe(document.documentElement)
    // a load event doesn't bubble, but it can be caught on its way down
    const loaded = (e: Event) => {
      if (e.target instanceof HTMLImageElement) capturer.schedule(LOAD_SETTLE_MS)
    }
    const fontsLoaded = () => capturer.schedule(LOAD_SETTLE_MS)
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

  // a picture is the whole page, so the one that was replaced has to be freed, or each capture leaves one on the GPU
  useEffect(
    () => () => {
      if (picture) releaseSnapshot(picture)
    },
    [picture]
  )

  return picture
}

const pageSize = () => `${document.documentElement.scrollWidth}x${document.documentElement.scrollHeight}`

/**
 * The rectangle of an element as it is drawn (transforms included), and the size of its box before them: the
 * canvas of a glass has the second and draws the first.
 */
export type GlassBounds = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
  readonly layoutWidth: number
  readonly layoutHeight: number
}

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

const sameRect = (a: GlassBounds, b: DOMRect) =>
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
