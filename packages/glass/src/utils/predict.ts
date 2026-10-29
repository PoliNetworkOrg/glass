// Where something that moves with the scroll will be a moment from now.
//
// The browser scrolls the page off the page's thread and tells it afterwards, and what the glass draws from that
// reaches the screen a frame or two later still, so the page under the glass is drawn where it was, behind where it is.
// A flick slows down smoothly, so how fast it went over the last frames says well where it will be: the glass is drawn
// there, ahead by about the time it is late.

/** An instantaneous speed past this, in px per ms, is a jump (an anchor, a scrollTo) and not a scroll, and isn't followed */
const MAX_SPEED = 12
/** A lead under this, in px, is let go, so that a page that stopped stops being drawn again */
const REST = 0.05

/**
 * Makes a predictor for one moving point. Called once a frame with where the point is, it returns where it will be
 * `lead` ms later, at the speed it has had over the last frames.
 */
export function createPredictor() {
  /** The last frame's time and point, and the speed it is moving at, in px per ms */
  const last = { t: 0, x: 0, y: 0, vx: 0, vy: 0 }

  return (time: number, x: number, y: number, lead: number): [number, number] => {
    const dt = time - last.t
    if (last.t > 0 && dt > 0 && dt < 100) {
      const ix = (x - last.x) / dt
      const iy = (y - last.y) / dt
      if (Math.hypot(ix, iy) > MAX_SPEED) {
        last.vx = 0
        last.vy = 0
      } else {
        // a frame where it didn't move is either a stop or a scroll whose news is late, so half the speed is kept
        last.vx = ix === 0 ? last.vx / 2 : (last.vx + ix) / 2
        last.vy = iy === 0 ? last.vy / 2 : (last.vy + iy) / 2
      }
    } else if (dt !== 0) {
      // the first frame, or one after a long pause: there is no speed to go by
      last.vx = 0
      last.vy = 0
    }
    last.t = time
    last.x = x
    last.y = y
    if (Math.abs(last.vx * lead) < REST) last.vx = 0
    if (Math.abs(last.vy * lead) < REST) last.vy = 0
    return [x + last.vx * lead, y + last.vy * lead]
  }
}
