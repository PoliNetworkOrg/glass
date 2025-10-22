import { useMotionValue } from "motion/react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
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
 * @returns The current background texture, or null if not yet loaded
 */
export function useBackgroundTexture(deps: unknown[] = [], blur: number = 0): Texture | null {
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
    if (!promiseRef.current) {
      // if no update is in progress, start one
      void updateTexture()
    } else {
      // if an update is already in progress, mark for a second update
      secondRef.current = true
    }
  }, [updateTexture])

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      dispatchUpdate()
    })
    observer.observe(document.documentElement)
    return () => {
      observer.disconnect()
    }
  }, [dispatchUpdate])

  useEffect(() => {
    dispatchUpdate()
  }, deps)

  return texture
}

/**
 * # useMotionBounds
 * Custom hook to track the bounding rectangle of a DOM element using motion values.
 *
 * Having the bounds as motion values allows for smooth animations without constant re-renders.
 *
 * It accounts for visual viewport offsets and updates on resize and scroll events.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport
 *
 * _The DOM is the biggest threat to performance yet again_
 *
 * @return A tuple containing:
 *   - A ref to be attached to the target DOM element.
 *   - A MotionValue representing the bounding rectangle of the element.
 */
export function useMotionBounds() {
  const motionValues = useMotionValue<RectReadOnly>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  })
  const ref = useRef<HTMLDivElement | null>(null)

  // // the offsets in size for the visual viewport, or safari stutters like crazy
  // // thanks, apple
  // const vpOffsets = useMotionValue({ w: 0, h: 0 })
  // useAnimationFrame(() => {
  //   if (window.visualViewport) {
  //     vpOffsets.set({
  //       w: window.visualViewport.width - window.innerWidth,
  //       h: window.visualViewport.height - window.innerHeight,
  //     })
  //   }
  // })

  useEffect(() => {
    const updatePosition = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect()
        const { x, y, width, height, top, right, bottom, left } = rect
        motionValues.set({ x, y, width, height, top, right, bottom, left })
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

  // const bounds = useTransform(() => {
  //   const offsets = vpOffsets.get()
  //   const rect = motionValues.get()
  //   return {
  //     x: rect.x + offsets.w / 2,
  //     y: rect.y + offsets.h / 2,
  //     width: rect.width,
  //     height: rect.height,
  //     top: rect.top + offsets.h / 2,
  //     right: rect.right + offsets.w / 2,
  //     bottom: rect.bottom + offsets.h / 2,
  //     left: rect.left + offsets.w / 2,
  //   }
  // })

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
 * # useFailCondition
 * React hook to trigger a suspense fail condition based on a dynamic check.
 *
 * @param check A function that returns a boolean indicating whether to trigger
 * the fail condition
 */
export function useFailCondition(check: () => boolean) {
  const condition = check()
  const suspenderRef = useRef<Promise<never> | null>(null)

  if (condition) {
    if (!suspenderRef.current) {
      suspenderRef.current = new Promise<never>(() => {})
    }
    throw suspenderRef.current
  } else {
    suspenderRef.current = null
  }
}
