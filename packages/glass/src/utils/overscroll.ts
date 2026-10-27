import { useEffect, useMemo, useState, useSyncExternalStore } from "react"

// Where a browser bounces the page when it is pulled past its end (Firefox and Safari do), it does it on its own,
// off the page's thread, and the page isn't told: no scroll position, offset or element position changes (measured
// in Firefox), so a glass that draws the page on a canvas can't follow it. It can see what starts it though: wheel
// and touch input pushing past the end. While that goes on, and for as long as the bounce takes to settle, the 3D
// glass gives way to the CSS glass, whose backdrop the browser itself keeps in step.
//
// It is a guess about the browser, so it holds back where the guess would be wrong:
//   - a wheel with notches (whole number deltas) doesn't bounce the page, only continuous input does
//   - input over something that can still scroll is its

/** How long after the last push the bounce is taken to go on */
const SETTLE = 800

const listeners = new Set<() => void>()
let pushing = false
let release: ReturnType<typeof setTimeout> | undefined
/** The browser told us where the overscroll is (the scroll position went past its end): no need to give way */
let exposed = false
let continuousUntil = 0

const set = (value: boolean) => {
  if (pushing === value) return
  pushing = value
  for (const listener of listeners) listener()
}

const push = () => {
  if (exposed) return
  set(true)
  clearTimeout(release)
  release = setTimeout(() => set(false), SETTLE)
}

/** Whether `el` can scroll further the way the input goes, `dy` and `dx` being the direction of the content */
function canScroll(target: EventTarget | null, dx: number, dy: number) {
  const root = document.scrollingElement
  for (let n = target instanceof Element ? target : null; n && n !== root && n !== document.body; n = n.parentElement) {
    const style = getComputedStyle(n)
    if (dy && /auto|scroll/.test(style.overflowY) && n.scrollHeight > n.clientHeight) {
      if (dy < 0 ? n.scrollTop > 0 : n.scrollTop + n.clientHeight < n.scrollHeight - 1) return true
    }
    if (dx && /auto|scroll/.test(style.overflowX) && n.scrollWidth > n.clientWidth) {
      if (dx < 0 ? n.scrollLeft > 0 : n.scrollLeft + n.clientWidth < n.scrollWidth - 1) return true
    }
  }
  return false
}

/** The input at (dx, dy) is pushing the page past its end */
function pushesPastEnd(target: EventTarget | null, dx: number, dy: number) {
  const el = document.scrollingElement
  if (!el) return false
  if (el.scrollTop < -0.5 || el.scrollTop > el.scrollHeight - el.clientHeight + 0.5) {
    // the position goes past the end: the glass can follow it by itself
    exposed = true
    set(false)
    return false
  }
  const atTop = el.scrollTop <= 0
  const atBottom = el.scrollTop >= el.scrollHeight - el.clientHeight - 0.5
  const atLeft = el.scrollLeft <= 0
  const atRight = el.scrollLeft >= el.scrollWidth - el.clientWidth - 0.5
  const out = (dy < 0 && atTop) || (dy > 0 && atBottom) || (dx < 0 && atLeft) || (dx > 0 && atRight)
  return out && !canScroll(target, dx, dy)
}

const onWheel = (e: WheelEvent) => {
  if (!Number.isInteger(e.deltaX) || !Number.isInteger(e.deltaY)) continuousUntil = e.timeStamp + 1500
  if (e.timeStamp > continuousUntil) return
  if (pushesPastEnd(e.target, e.deltaX, e.deltaY)) push()
}

let touchX = 0
let touchY = 0
const onTouchStart = (e: TouchEvent) => {
  touchX = e.touches[0]?.clientX ?? 0
  touchY = e.touches[0]?.clientY ?? 0
}
const onTouchMove = (e: TouchEvent) => {
  const t = e.touches[0]
  if (!t) return
  // the content follows the finger, so what the page scrolls is the opposite of how the finger moves
  const dx = touchX - t.clientX
  const dy = touchY - t.clientY
  touchX = t.clientX
  touchY = t.clientY
  if (pushesPastEnd(e.target, dx, dy)) push()
}
const onScroll = () => {
  const el = document.scrollingElement
  if (el && (el.scrollTop < -0.5 || el.scrollTop > el.scrollHeight - el.clientHeight + 0.5)) {
    exposed = true
    set(false)
  }
}

const subscribe = (listener: () => void) => {
  if (listeners.size === 0) {
    window.addEventListener("wheel", onWheel, { passive: true })
    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    window.addEventListener("scroll", onScroll, { passive: true })
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("scroll", onScroll)
      clearTimeout(release)
      pushing = false
    }
  }
}

/**
 * Whether the page is being pushed past its end, and so may be bouncing where the page can't see it.
 *
 * @param enabled Listen at all. Off for glass that isn't drawn.
 */
export function useOverscroll(enabled = true) {
  // a subscribe that is the same function from one render to the next, or each change would end in a new one and the
  // state is dropped when the last listener leaves
  const follow = useMemo(() => (enabled ? subscribe : () => () => {}), [enabled])
  return useSyncExternalStore(
    follow,
    () => enabled && pushing,
    () => false
  )
}

/**
 * Follows `active` with a delay on the way out, so something that fades away can stay mounted until it is gone.
 *
 * @returns `mounted` while it is there, and `visible` for what it is meant to show (a frame after it mounts, so the
 * transition has something to start from)
 */
export function useFade(active: boolean, ms: number) {
  const [mounted, setMounted] = useState(active)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (active) {
      setMounted(true)
      const frame = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(frame)
    }
    setVisible(false)
    const timer = setTimeout(() => setMounted(false), ms)
    return () => clearTimeout(timer)
  }, [active, ms])

  return { mounted, visible }
}
