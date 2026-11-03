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
export const frameScroll = { x: 0, y: 0 }

function tick(time: number) {
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
  for (const draw of drawers) draw(time)
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
