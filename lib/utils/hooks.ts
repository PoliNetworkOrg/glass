import { useMotionValue } from "motion/react"
import { useCallback, useEffect, useRef, useState } from "react"
import useMeasure, { type RectReadOnly } from "react-use-measure"
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

export function useBackgroundTexture(deps: unknown[] = []) {
  const promiseRef = useRef<Promise<Texture> | null>(null) // current texture promise
  const secondRef = useRef<boolean>(false) // flag to indicate if a second update is needed
  const [texture, setTexture] = useState<Texture | null>(null)

  const updateTexture = useCallback(async () => {
    secondRef.current = false // reset second update flag
    promiseRef.current = getTexture(document.documentElement) // start new texture promise
    const tex = await promiseRef.current // wait for texture to be ready
    promiseRef.current = null // clear current promise

    if (secondRef.current) {
      // if a second update was requested, do it again
      void updateTexture()
    } else {
      setTexture(tex)
    }
  }, [])

  // Function to dispatch texture update
  const dispatchUpdate = useCallback(() => {
    if (!promiseRef.current) {
      // if no update is in progress, start one
      console.log("First time updating texture")
      void updateTexture()
    } else {
      // if an update is already in progress, mark for a second update
      console.log("Marking for second update")
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

// export function useDocumentSize() {
//   const dom = document.documentElement
//   const [size, setSize] = useState({
//     width: dom.scrollWidth,
//     height: dom.scrollHeight,
//   })

//   // useLayoutEffect(() => {
//   //   const observer = new ResizeObserver(() => {
//   //     setSize({ width: dom.scrollWidth, height: dom.scrollHeight })
//   //   })
//   //   observer.observe(document.documentElement)
//   //   return () => {
//   //     observer.disconnect()
//   //   }
//   // }, [])

//   return size
// }

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
  const [ref, bounds] = useMeasure({ scroll: true, debounce: 0 })

  useEffect(() => {
    motionValues.set(bounds)
  }, [bounds])

  return [ref, motionValues] as const
}
