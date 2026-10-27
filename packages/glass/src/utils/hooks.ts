import { useMotionValue } from "motion/react"
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
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

/**
 *  # useBackgroundTexture
 * React hook to load and update the background texture based on the document element.
 *
 * It uses a ResizeObserver to monitor changes to the document layout and updates
 * the texture accordingly.
 *
 * ### Note
 * This hook ensures that if multiple updates are triggered in quick succession,
 * it will only perform the necessary updates to avoid redundant texture loads,
 * since calling {@link html2canvas} can be quite heavy.
 *
 * @param deps The dependency array for the texture to be considered invalid, passed to {@link useEffect}
 * @param blur Blur amount for the texture
 * @param enabled When false nothing is captured, which is the expensive part, and there is no texture
 * @returns The current background texture, or null if not yet loaded
 */
export function useBackgroundTexture(deps: unknown[] = [], blur: number = 0, enabled: boolean = true): Texture | null {
  const promiseRef = useRef<Promise<Texture> | null>(null) // current texture promise
  const secondRef = useRef<boolean>(false) // flag to indicate if a second update is needed
  const [texture, setTexture] = useState<Texture | null>(null)

  const updateTexture = useCallback(async () => {
    secondRef.current = false // reset second update flag
    promiseRef.current = getTexture(document.documentElement, blur) // start new texture promise
    const tex = await promiseRef.current // wait for texture to be ready
    promiseRef.current = null // clear current promise

    if (secondRef.current) {
      // if a second update was requested, do it again
      void updateTexture()
    } else {
      setTexture(tex)
    }
  }, [blur])

  // Function to dispatch texture update
  const dispatchUpdate = useCallback(() => {
    if (!enabled) return
    if (!promiseRef.current) {
      // if no update is in progress, start one
      void updateTexture()
    } else {
      // if an update is already in progress, mark for a second update
      secondRef.current = true
    }
  }, [updateTexture, enabled])

  useEffect(() => {
    if (!enabled) {
      setTexture(null)
      return
    }
    const observer = new ResizeObserver(() => {
      dispatchUpdate()
    })
    observer.observe(document.documentElement)
    return () => {
      observer.disconnect()
    }
  }, [dispatchUpdate, enabled])

  useEffect(() => {
    dispatchUpdate()
  }, deps)

  // a texture is the whole page, so the one that was replaced has to be freed, or each capture leaves one on the GPU
  useEffect(() => () => texture?.dispose(), [texture])

  return texture
}

type Watcher = () => (() => void) | undefined

const watchers = new Set<Watcher>()
let frame = 0

function tick() {
  frame = requestAnimationFrame(tick)
  // everything is read before anything is written, so a glass that redraws doesn't force a layout for the next one
  const commits: (() => void)[] = []
  for (const read of watchers) {
    const commit = read()
    if (commit) commits.push(commit)
  }
  for (const commit of commits) commit()
}

/**
 * Calls `read` on every frame, and the function it returns, if it does, after all the other watchers have read.
 * All of them share one animation frame loop, which only runs while there is one.
 */
function watchFrames(read: Watcher) {
  watchers.add(read)
  if (!frame) frame = requestAnimationFrame(tick)
  return () => {
    watchers.delete(read)
    if (watchers.size === 0) {
      cancelAnimationFrame(frame)
      frame = 0
    }
  }
}

/**
 * The rectangle of an element as it is drawn (transforms included), and the size of its box before them: the
 * canvas of a glass has the second and draws the first.
 */
export type GlassBounds = RectReadOnly & { layoutWidth: number; layoutHeight: number }

const boundsOf = (el: HTMLElement, rect: DOMRect): GlassBounds => ({
  x: rect.x,
  y: rect.y,
  width: rect.width,
  height: rect.height,
  top: rect.top,
  right: rect.right,
  bottom: rect.bottom,
  left: rect.left,
  layoutWidth: el.offsetWidth,
  layoutHeight: el.offsetHeight,
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
 * events, so while `watch` is true the rectangle is also read on every frame, and only changes when it moved.
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
        motionValues.set(boundsOf(ref.current, ref.current.getBoundingClientRect()))
      }
    }

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
  }, [ref.current])

  useEffect(() => {
    if (!watch) return
    return watchFrames(() => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (sameRect(motionValues.get(), rect)) return
      return () => motionValues.set(boundsOf(el, rect))
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
