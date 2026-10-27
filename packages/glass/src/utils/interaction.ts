import { type CSSProperties, type PointerEvent, useCallback, useEffect, useState } from "react"

// The numbers are the ones of Vitrium, measured against iOS: a hovered glass lifts, a pressed one snaps down
// fast and springs back slowly, and a pressed one is "lit", as if it caught more light.
const HOVER_SCALE = 1.045
const PRESS_SCALE = 0.94
const PRESS_IN = "0.11s cubic-bezier(0.3, 0, 0.4, 1)"
const PRESS_OUT = "0.5s cubic-bezier(0.34, 1.56, 0.64, 1)"
const LIT = "brightness(1.11) saturate(1.35)"

type Handlers<T extends Element> = {
  onPointerEnter?: (event: PointerEvent<T>) => void
  onPointerLeave?: (event: PointerEvent<T>) => void
  onPointerDown?: (event: PointerEvent<T>) => void
}

/**
 * # useGlassInteraction
 * The lift on hover and the press, which snaps the glass down and lights it.
 *
 * @param enabled Without it nothing is tracked and the styles are empty
 * @param reducedMotion When set the glass doesn't move, and is only lit while pressed
 * @param handlers The handlers the element already has, which are called as well
 * @returns The style of the element (its `scale`), the style of the layer that holds the glass (its light), and
 * the handlers to put on the element
 */
export function useGlassInteraction<T extends Element>(
  enabled: boolean,
  reducedMotion: boolean,
  handlers: Handlers<T>
) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  // the pointer can be released anywhere, not only on the glass
  useEffect(() => {
    if (!pressed) return
    const release = () => setPressed(false)
    window.addEventListener("pointerup", release)
    window.addEventListener("pointercancel", release)
    return () => {
      window.removeEventListener("pointerup", release)
      window.removeEventListener("pointercancel", release)
    }
  }, [pressed])

  const { onPointerEnter, onPointerLeave, onPointerDown } = handlers

  const enter = useCallback(
    (event: PointerEvent<T>) => {
      // a finger doesn't hover, and would leave the glass lifted after a tap
      if (event.pointerType === "mouse") setHovered(true)
      onPointerEnter?.(event)
    },
    [onPointerEnter]
  )
  const leave = useCallback(
    (event: PointerEvent<T>) => {
      setHovered(false)
      onPointerLeave?.(event)
    },
    [onPointerLeave]
  )
  const down = useCallback(
    (event: PointerEvent<T>) => {
      setPressed(true)
      onPointerDown?.(event)
    },
    [onPointerDown]
  )

  if (!enabled) return { style: {} as CSSProperties, lightStyle: {} as CSSProperties, handlers: {} }

  const scale = reducedMotion ? 1 : pressed ? PRESS_SCALE : hovered ? HOVER_SCALE : 1
  return {
    style: {
      scale: String(scale),
      transition: reducedMotion ? undefined : `scale ${pressed ? PRESS_IN : PRESS_OUT}`,
    } as CSSProperties,
    lightStyle: {
      filter: pressed ? LIT : undefined,
      transition: "filter 0.2s ease",
    } as CSSProperties,
    handlers: { onPointerEnter: enter, onPointerLeave: leave, onPointerDown: down },
  }
}
