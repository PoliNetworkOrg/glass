// Where something that moves with the scroll will be a moment from now.
//
// The browser scrolls the page off the page's thread and tells it afterwards, and what the glass draws from that
// reaches the screen a frame or two later still, so the page under the glass is drawn where it was, behind where it is.
// A flick slows down smoothly, so how fast it went over the last frames says well where it will be: the glass is drawn
// there, ahead by about the time it is late.
//
// What the browser says is rough: whole pixels, and at slow speeds frames with no news at all, then two frames' worth.
// The speed is a line fitted to the last tenth of a second of it, and the point is where that line is now, which
// smooths the roughness out instead of passing it on. Ahead is only worth it where the lag shows: a slow scroll, the
// one to look at the glass closely, is drawn where the line is, and the lead comes in with the speed. Simulated against
// the frame to frame differences this replaces, it shakes from half to a quarter as much at every speed.

/** An instantaneous speed past this, in px per ms, is a jump (an anchor, a scrollTo) and not a scroll, and isn't followed */
const MAX_SPEED = 12
/** How far back the line is fitted, in ms */
const WINDOW = 100
/** How long without moving is a stop, in ms */
const STILL = 50
/** A frame without news, in ms: it is taken for a late report and not yet for a stop */
const QUIET = 25
/** Under this speed, in px per ms, nothing is predicted, and from it to `FAST` the lead comes in */
const SLOW = 0.25
const FAST = 0.8

/** How much of the lead is used at `speed`: none when slow, all when fast, smoothly between */
const ramp = (speed: number) => {
  const t = Math.min(1, Math.max(0, (speed - SLOW) / (FAST - SLOW)))
  return t * t * (3 - 2 * t)
}

/** The line fitted to `samples` (time, position): where it is at `time`, and its slope */
function fit(samples: [number, number][], time: number): [number, number] {
  let st = 0
  let sp = 0
  for (const [t, p] of samples) {
    st += t
    sp += p
  }
  const mt = st / samples.length
  const mp = sp / samples.length
  let num = 0
  let den = 0
  for (const [t, p] of samples) {
    num += (t - mt) * (p - mp)
    den += (t - mt) ** 2
  }
  const slope = den > 0 ? num / den : 0
  return [mp + slope * (time - mt), slope]
}

/**
 * Makes a predictor for one moving point. Called once a frame with where the point is, it returns where it will be
 * `lead` ms later, at the speed it has had over the last frames.
 */
export function createPredictor() {
  const xs: [number, number][] = []
  const ys: [number, number][] = []
  /** Where it was last frame, and when it last moved */
  const last = { t: 0, x: 0, y: 0, moved: 0 }

  return (time: number, x: number, y: number, lead: number): [number, number] => {
    if (last.t === 0 || x !== last.x || y !== last.y) last.moved = time
    // a jump starts over, as does a pause long enough for the window to be empty
    const dt = Math.max(1, time - last.t)
    if (last.t > 0 && Math.hypot(x - last.x, y - last.y) / dt > MAX_SPEED) {
      xs.length = 0
      ys.length = 0
    }
    last.t = time
    last.x = x
    last.y = y
    xs.push([time, x])
    ys.push([time, y])
    while (xs.length > 0 && xs[0][0] < time - WINDOW) {
      xs.shift()
      ys.shift()
    }

    const since = time - last.moved
    if (since >= STILL || xs.length < 3) return [x, y]
    const [fx, vx] = fit(xs, time)
    const [fy, vy] = fit(ys, time)
    const k = lead * ramp(Math.hypot(vx, vy))
    // A frame without news is a late report or a stop, which there is no telling apart yet: the first is let be, and
    // from the second what is ahead of where it was fades out, so a scroll that stops dead doesn't overshoot for long
    const fade = since < QUIET ? 1 : Math.max(0, 1 - (since - QUIET) / (STILL - QUIET))
    return [x + (fx + vx * k - x) * fade, y + (fy + vy * k - y) * fade]
  }
}
