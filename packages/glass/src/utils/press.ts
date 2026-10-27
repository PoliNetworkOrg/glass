// The press, the hover and the drag of a glass that is a control. Hold it and drag: it stretches toward the
// pointer with an elastic falloff, and squashes on the other axis, like a blob of viscous glass. Let go and it
// springs back past where it was. A drag is a gesture and not a press, so the click that would follow it is
// swallowed.
//
// It writes the element's `translate` and `scale` (and the light of its glass layer) directly on every move,
// which React state would be too slow for, so while it is attached it owns them. They are independent CSS
// properties, so they stack on whatever `transform` the element has.
//
// A touch on glass inside something scrollable still scrolls it: the element leaves the touch to the browser
// (touch-action: manipulation), and when the browser takes it over to scroll (pointercancel) the press carries
// on, pressed and lit, on touch events until the finger lifts. The stretch follows the finger relative to the
// element and not the screen, so while the content scrolls under the finger the glass rides along unstretched,
// and only pulls toward the finger where it slides off (the scroll hit its end). Glass on a layer above the
// content (a fixed header, a popover) has nothing to scroll and claims the touch instead.
//
// The numbers are Vitrium's, measured against iOS.

const HOVER_SCALE = 1.045
/** How hard the element scales down the instant it is touched, before any drag */
const PRESS_SCALE = 0.94
/** Pointer travel before a gesture is a drag and not a tap. 3px was under the jitter of a real finger's tap. */
const DRAG_THRESHOLD = 8
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)"
const PRESS_IN = "0.11s cubic-bezier(0.3, 0, 0.4, 1)"
const SETTLE_S = 0.5
const LIT = "brightness(1.11) saturate(1.35)"
/** What can sit inside a glass (a link in a popover) and is its own: a press that starts on it isn't the glass's */
const INNER_CONTROL = 'a, button, input, select, textarea, [role="button"]'

export type GlassPressOptions = {
  /** The glass sits above the content, so a touch on it is its own and never scrolls what is under it */
  claimTouch?: boolean
}

const prefersReducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

// Touches on the screen, so a press that was handed over to a scroll can tell whether its finger is still down
// (pointer events stop once the browser scrolls)
let touchesDown = 0
let watching = false
function watchTouches() {
  if (watching || typeof document === "undefined") return
  watching = true
  const count = (e: TouchEvent) => {
    touchesDown = e.touches.length
  }
  for (const type of ["touchstart", "touchend", "touchcancel"] as const) {
    document.addEventListener(type, count, { capture: true, passive: true })
  }
}

/** The ancestors whose scrolling moves the element on screen, up to the first fixed one, with their offsets now */
function scrollers(el: HTMLElement) {
  const list: [Element, number, number][] = []
  for (let n = el.parentElement; n; n = n.parentElement) {
    if (n.scrollHeight > n.clientHeight || n.scrollWidth > n.clientWidth) list.push([n, n.scrollLeft, n.scrollTop])
    if (getComputedStyle(n).position === "fixed") return list
  }
  const root = document.scrollingElement
  if (root && !list.some(([n]) => n === root)) list.push([root, root.scrollLeft, root.scrollTop])
  return list
}

/**
 * Makes a glass element a control: it lifts on hover, snaps down and lights up when pressed, and stretches when
 * dragged.
 *
 * @param el The element of the glass. Its `._polinetwork_glass-content` child is the layer that is lit.
 * @param options
 * @returns A function that detaches it and puts the element back
 */
export function attachGlassPress(el: HTMLElement, options: GlassPressOptions = {}): () => void {
  const layer = () => el.querySelector<HTMLElement>(":scope > ._polinetwork_glass-content")

  const own = {
    touchAction: el.style.touchAction,
    userSelect: el.style.userSelect,
    zIndex: el.style.zIndex,
  }
  el.style.touchAction = options.claimTouch ? "none" : "manipulation"
  el.style.userSelect = "none"
  ;(el.style as CSSStyleDeclaration & { webkitTouchCallout: string }).webkitTouchCallout = "none"

  let hovered = false
  let active = false
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  /** The z-index the element had before it was raised for the gesture, while it is raised */
  let raisedFrom: string | null = null

  const transition = (mode: "rest" | "press" | "drag") => {
    const t =
      mode === "drag"
        ? "0s"
        : mode === "press"
          ? PRESS_IN
          : prefersReducedMotion()
            ? "0.15s ease"
            : `${SETTLE_S}s ${SPRING}`
    el.style.transition = `scale ${t}, translate ${t}`
  }
  const rest = () => {
    el.style.translate = ""
    el.style.scale = hovered && !prefersReducedMotion() ? String(HOVER_SCALE) : ""
  }
  const light = (on: boolean) => {
    const l = layer()
    if (!l) return
    l.style.transition = "filter 0.2s ease"
    l.style.filter = on ? LIT : ""
  }
  // raised above its neighbours for the whole gesture and the spring back, so it never slips behind what it overlaps
  const raise = () => {
    if (raisedFrom === null) raisedFrom = el.style.zIndex
    el.style.zIndex = "9999"
  }

  transition("rest")

  const onEnter = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return
    hovered = true
    if (!active) rest()
  }
  const onLeave = () => {
    hovered = false
    if (!active) rest()
  }

  const begin = (e: PointerEvent) => {
    // secondary mouse buttons, and a press that is already going, are not ours
    if (e.pointerType === "mouse" && e.button !== 0) return
    if (active) return
    const target = e.target as Element | null
    const inner = target?.closest(INNER_CONTROL)
    if (inner && inner !== el && el.contains(inner)) return

    active = true
    clearTimeout(settleTimer)
    watchTouches()
    raise()
    const startX = e.clientX
    const startY = e.clientY
    let lastX = startX
    let lastY = startY
    let dragging = false
    const scrolled = scrollers(el)
    /** How far the scrolling has carried the element since the press began */
    const carried = () => {
      let x = 0
      let y = 0
      for (const [n, l, t] of scrolled) {
        x += n.scrollLeft - l
        y += n.scrollTop - t
      }
      return [-x, -y]
    }

    transition("press")
    el.style.scale = String(PRESS_SCALE)
    light(true)
    // so the move and the release keep coming even when the pointer leaves the box
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* not fatal */
    }

    /** The finger is at (x, y): the stretch follows it relative to the element */
    const follow = (x: number, y: number) => {
      lastX = x
      lastY = y
      const [cx, cy] = carried()
      const dx = x - startX - cx
      const dy = y - startY - cy

      if (!dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        dragging = true
        transition("drag")
      }
      // reduced motion keeps the snap down and the light, and skips the stretch
      if (prefersReducedMotion()) return

      const dist = Math.hypot(dx, dy) || 1
      const ux = dx / dist
      const uy = dy / dist
      // the element chases the pointer less and less the further it is pulled, so it never runs from its place
      const give = 16 * Math.log1p(dist / 16)
      const shift = give * 0.7
      // stretched along the drag, squashed across it, and capped so it stays a panel and not a puddle
      const s = Math.min(give / 240, 0.16)
      const sx = PRESS_SCALE * (1 + s * Math.abs(ux) - s * 0.45 * Math.abs(uy))
      const sy = PRESS_SCALE * (1 + s * Math.abs(uy) - s * 0.45 * Math.abs(ux))

      el.style.translate = `${(ux * shift).toFixed(2)}px ${(uy * shift).toFixed(2)}px`
      el.style.scale = `${sx.toFixed(4)} ${sy.toFixed(4)}`
    }

    /** `released`: the pointer went up over the element, which can still click it */
    const finish = (released: boolean) => {
      active = false

      // a drag is a gesture and not a press, so the click a release would make is swallowed. A tap never drags, and
      // a scroll never clicks anything.
      if (released && dragging) {
        const swallow = (ev: Event) => {
          ev.stopImmediatePropagation()
          ev.preventDefault()
        }
        el.addEventListener("click", swallow, { capture: true, once: true })
        setTimeout(() => el.removeEventListener("click", swallow, { capture: true }), 0)
      }

      // the spring carries it home (or to the hover, if the pointer is still over it)
      transition("rest")
      rest()
      light(false)
      settleTimer = setTimeout(
        () => {
          if (raisedFrom !== null) el.style.zIndex = raisedFrom
          raisedFrom = null
        },
        (prefersReducedMotion() ? 0.15 : SETTLE_S) * 1000 + 60
      )
    }

    const detach = () => {
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerup", onUp)
      el.removeEventListener("pointercancel", onCancel)
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        /* already gone */
      }
    }
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId === e.pointerId) follow(ev.clientX, ev.clientY)
    }
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      detach()
      finish(true)
    }
    // The browser took a touch over, to scroll mostly: the press goes on, on the touch's own events, until the
    // finger lifts. Any other cancel ends it.
    const onCancel = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      detach()
      if (e.pointerType !== "touch" || touchesDown === 0) {
        finish(false)
        return
      }
      let id: number | null = null
      const touchOf = (list: TouchList) => {
        if (id == null) {
          // the touch nearest to where the pointer was last seen
          let best: Touch | null = null
          let bestD = Number.POSITIVE_INFINITY
          for (const t of Array.from(list)) {
            const d = Math.hypot(t.clientX - lastX, t.clientY - lastY)
            if (d < bestD) {
              best = t
              bestD = d
            }
          }
          id = best?.identifier ?? null
          return best
        }
        return Array.from(list).find((t) => t.identifier === id) ?? null
      }
      const onTouchMove = (te: TouchEvent) => {
        const t = touchOf(te.touches)
        if (t) follow(t.clientX, t.clientY)
      }
      const onTouchEnd = (te: TouchEvent) => {
        const gone = id == null ? te.touches.length === 0 : !Array.from(te.touches).some((t) => t.identifier === id)
        if (!gone) return
        document.removeEventListener("touchmove", onTouchMove, true)
        document.removeEventListener("touchend", onTouchEnd, true)
        document.removeEventListener("touchcancel", onTouchEnd, true)
        finish(false)
      }
      document.addEventListener("touchmove", onTouchMove, { capture: true, passive: true })
      document.addEventListener("touchend", onTouchEnd, { capture: true, passive: true })
      document.addEventListener("touchcancel", onTouchEnd, { capture: true, passive: true })
    }

    el.addEventListener("pointermove", onMove)
    el.addEventListener("pointerup", onUp)
    el.addEventListener("pointercancel", onCancel)
  }

  el.addEventListener("pointerenter", onEnter)
  el.addEventListener("pointerleave", onLeave)
  el.addEventListener("pointerdown", begin)

  return () => {
    el.removeEventListener("pointerenter", onEnter)
    el.removeEventListener("pointerleave", onLeave)
    el.removeEventListener("pointerdown", begin)
    clearTimeout(settleTimer)
    el.style.translate = ""
    el.style.scale = ""
    el.style.transition = ""
    el.style.touchAction = own.touchAction
    el.style.userSelect = own.userSelect
    el.style.zIndex = raisedFrom ?? own.zIndex
    light(false)
  }
}
