// One animation frame loop for all the glass: every frame it reads where the page is scrolled and where each glass
// is, then commits what changed, then draws, so nothing that is written forces a layout for the next read, and what
// is drawn is from this frame. It runs only while something uses it.

export type Watcher = () => (() => void) | undefined

const watchers = new Set<Watcher>()
const drawers = new Set<(time: number) => void>()
let frame = 0

/**
 * Where the page is scrolled, read once at the start of each frame for every glass. It is read from the window and not
 * from scroll events: where the page is pulled past its end (an overscroll) it can change without one.
 */
export const frameScroll = {
  x: 0,
  y: 0,
  /** How fast it moved over the last frame, in px per ms */
  speed: 0,
}

/** How long a frame of the display is, in ms, smoothed over the last frames */
let frameTime = 1000 / 60
let lastTime = 0
/** What last scrolled the page: a finger, or a wheel (a mouse's or a trackpad's) */
let input: "touch" | "wheel" | null = null
const onTouch = () => {
  input = "touch"
}
const onWheel = () => {
  input = "wheel"
}

/**
 * How far ahead, in ms, the glass draws the page while it moves, when the provider doesn't say: a frame of the display
 * while a finger scrolls the page, and nothing while a wheel does.
 *
 * The browser tells the page it scrolled a frame after it did, so a frame is what the glass is behind. A flick slows
 * down smoothly, which a lead follows well, while a wheel stops dead, which a lead overshoots: there a frame behind,
 * which holds still, shows less. Before any input, a device whose pointer is a finger counts as touch.
 */
export function autoLead() {
  // asked once: it runs for every glass on every frame, and each matchMedia() is a new object to collect
  coarse ??= matchMedia("(pointer: coarse)").matches
  const touch = input === null ? coarse : input === "touch"
  return touch ? frameTime : 0
}
let coarse: boolean | undefined
/** What the watchers have to write on this frame, one list kept from frame to frame */
const commits: (() => void)[] = []

function tick(time: number) {
  frame = requestAnimationFrame(tick)
  // a frame longer than this is a dropped frame or a pause, not the length of one
  const dt = time - lastTime
  if (lastTime > 0 && dt > 4 && dt < 40) frameTime += (dt - frameTime) * 0.1
  const x = window.scrollX
  const y = window.scrollY
  frameScroll.speed = lastTime > 0 && dt > 0 ? Math.hypot(x - frameScroll.x, y - frameScroll.y) / dt : 0
  lastTime = time
  frameScroll.x = x
  frameScroll.y = y
  // everything is read before anything is written, so a glass that redraws doesn't force a layout for the next one
  commits.length = 0
  for (const read of watchers) {
    const commit = read()
    if (commit) commits.push(commit)
  }
  for (const commit of commits) commit()
  // and drawn in the same frame, from what was just read: a glass drawn on the next one would be a frame behind
  for (const draw of drawers) draw(time)
}

// Safari on iOS tells the page where it is scrolled and where a finger is less often than the display draws, and a
// scroll-driven animation running on the page has it tell more. On an iPhone at 120Hz, with Safari's default of page
// updates near 60 a second, during a flick: from 51 to 72 scroll positions and from 60 to 95 touch moves a second,
// measured with the Frame lab of the demo running (which loads the page itself; the idea is from
// https://rida.dev/blog/bypassing-ios-safari-60-fps-limit). The animation is of a colour,
// which the compositor doesn't animate by itself, between two transparent ones, on an element of a pixel that shows
// nothing. It is there while the loop runs, and only where the pointer is a finger: that is where it was measured.

const KEEPALIVE_CLASS = "_polinetwork_glass-scroll-keepalive"
const KEEPALIVE_CSS = `
@keyframes ${KEEPALIVE_CLASS} { from { background-color: rgb(0 0 0 / 0) } to { background-color: rgb(255 255 255 / 0) } }
.${KEEPALIVE_CLASS} { position: fixed; top: 0; left: 0; width: 1px; height: 1px; pointer-events: none; contain: strict;
  animation: ${KEEPALIVE_CLASS} linear both; animation-timeline: scroll(root); }
`
/** Whether the page wants it, set by the provider (`scrollKeepalive`) */
let keepaliveWanted = true
let keepalive: HTMLElement | null = null

function addKeepalive() {
  if (keepalive || !keepaliveWanted) return
  coarse ??= matchMedia("(pointer: coarse)").matches
  if (!coarse || !CSS.supports("animation-timeline: scroll()")) return
  const element = document.createElement("div")
  element.className = KEEPALIVE_CLASS
  element.setAttribute("aria-hidden", "true")
  const style = document.createElement("style")
  style.textContent = KEEPALIVE_CSS
  element.append(style)
  document.body.append(element)
  keepalive = element
}

function removeKeepalive() {
  keepalive?.remove()
  keepalive = null
}

/** Turns the scroll-driven animation that has Safari report the scroll more often on or off (it is on by default) */
export function setScrollKeepalive(on: boolean) {
  keepaliveWanted = on
  if (!on) removeKeepalive()
  else if (watchers.size > 0 || drawers.size > 0) addKeepalive()
}

function startLoop() {
  if (!frame) {
    frame = requestAnimationFrame(tick)
    window.addEventListener("touchstart", onTouch, { passive: true, capture: true })
    window.addEventListener("wheel", onWheel, { passive: true, capture: true })
    addKeepalive()
  }
}

function stopLoopIfIdle() {
  if (watchers.size === 0 && drawers.size === 0) {
    cancelAnimationFrame(frame)
    frame = 0
    lastTime = 0
    window.removeEventListener("touchstart", onTouch, { capture: true })
    window.removeEventListener("wheel", onWheel, { capture: true })
    removeKeepalive()
  }
}

/**
 * Calls `read` on every frame, and the function it returns, if it does, after all the other watchers have read.
 * All of them share one animation frame loop, which only runs while there is one.
 */
export function watchFrames(read: Watcher) {
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
export function drawFrames(draw: (time: number) => void) {
  drawers.add(draw)
  startLoop()
  return () => {
    drawers.delete(draw)
    stopLoopIfIdle()
  }
}
