// Where something that moves with the scroll will be a moment from now.
//
// The browser scrolls the page off the page's thread and tells it afterwards, and what the glass draws from that
// reaches the screen a frame or two later still, so the page under the glass is drawn where it was, behind where it is.
// A flick slows down smoothly, so how fast it went over the last frames says well where it will be: the glass is drawn
// there, ahead by about the time it is late.
//
// What the browser says is rough: whole pixels, and at slow speeds frames with no news at all, then two frames' worth.
// The speed comes from a curve (a parabola) fitted to the last 80ms of it, read at the latest point, so it follows a
// flick as it speeds up and slows down instead of reading the speed of half a window ago, as a straight line does; and
// the lead is added to where the browser says the point is. Ahead is only worth it where the lag shows: a slow
// scroll, the one to look at the glass closely, is drawn where the browser says, and the lead comes in with the speed.
//
// A speed always reads somewhat late as a scroll starts and stops, so the glass trails, then overshoots, and where a
// scroll stops dead that swing shows more than a lag that holds still. Measured in Chrome at 120Hz during a 2000px/s
// wheel scroll that stops dead: a steady 15px behind with no lead, against 0px while moving with 8ms of lead but 29px
// behind as it starts and 13px past as it stops. So by default the lead is a frame only for touch, whose flicks slow
// down smoothly, and none for a wheel (`autoLead` in frames.ts).

/** An instantaneous speed past this, in px per ms, is a jump (an anchor, a scrollTo) and not a scroll, and isn't followed */
const MAX_SPEED = 12
/**
 * How far back the curve is fitted, in ms. Shorter follows a flick sooner but shakes more, from the whole pixels: in a
 * simulated flick at 60Hz, 100ms overshot by 20px as the finger let go and 60ms by 12px, but shook 1.9px a frame against
 * 1.2px, and 80ms is between the two
 */
const WINDOW = 80
/** How long without moving is a stop, in ms */
const STILL = 50
/** A frame without news, in ms: it is taken for a late report and not yet for a stop */
const QUIET = 25
/** How far, in px, it would have gone in a frame without news for that frame to be a stop and not a late report */
const MISSED = 3
/** Under this speed, in px per ms, nothing is predicted, and from it to `FAST` the lead comes in */
const SLOW = 0.25
const FAST = 0.8

/** How much of the lead is used at `speed`: none when slow, all when fast, smoothly between */
const ramp = (speed: number) => {
  const t = Math.min(1, Math.max(0, (speed - SLOW) / (FAST - SLOW)))
  return t * t * (3 - 2 * t)
}

/**
 * The speed at the last of the samples (`ts` the times, `ps` the positions), from the parabola fitted to them by least
 * squares, or from the line where there are too few for a parabola to mean anything. Plain arrays of numbers and an
 * indexed loop: it runs for every glass on every frame, and tuples and iterators there were garbage to collect, which
 * Safari does in pauses of 30 to 60ms
 */
function fit(ts: number[], ps: number[]): number {
  const n = ts.length
  const t0 = ts[n - 1]
  const p0 = ps[n - 1]
  // the sums of the normal equations, in time from the last sample so the numbers stay small
  let s1 = 0
  let s2 = 0
  let s3 = 0
  let s4 = 0
  let sp = 0
  let s1p = 0
  let s2p = 0
  for (let i = 0; i < n; i++) {
    const u = ts[i] - t0
    const q = ps[i] - p0
    s1 += u
    s2 += u * u
    s3 += u * u * u
    s4 += u * u * u * u
    sp += q
    s1p += u * q
    s2p += u * u * q
  }
  if (n >= 4) {
    // [n s1 s2; s1 s2 s3; s2 s3 s4] [c0 c1 c2] = [sp s1p s2p], by Cramer for c1, the slope at the last sample
    const det = n * (s2 * s4 - s3 * s3) - s1 * (s1 * s4 - s3 * s2) + s2 * (s1 * s3 - s2 * s2)
    if (Math.abs(det) > 1e-9) {
      return (n * (s1p * s4 - s3 * s2p) - sp * (s1 * s4 - s3 * s2) + s2 * (s1 * s2p - s1p * s2)) / det
    }
  }
  const den = n * s2 - s1 * s1
  return den > 0 ? (n * s1p - s1 * sp) / den : 0
}

/**
 * Makes a predictor for one moving point. Called once a frame with where the point is, it returns where it will be
 * `lead` ms later, at the speed it has had over the last frames.
 *
 * The pair it returns is the same array every time, overwritten by the next call: read it at once.
 */
export function createPredictor() {
  // the samples in the window, as three arrays of numbers, which allocate nothing once they have grown to its size
  const ts: number[] = []
  const xs: number[] = []
  const ys: number[] = []
  /** Where it was last frame, and when it last moved */
  const last = { t: 0, x: 0, y: 0, moved: 0 }
  const out: [number, number] = [0, 0]
  const result = (x: number, y: number) => {
    out[0] = x
    out[1] = y
    return out
  }

  return (time: number, x: number, y: number, lead: number): [number, number] => {
    const moving = last.t === 0 || x !== last.x || y !== last.y
    const dt = Math.max(1, time - last.t)
    // A jump starts over. So does a start after a stop: only the last still frame is kept, so the speed isn't read off a
    // window that is mostly standing still, which had the glass trail a flick by a few frames' worth as it started.
    if (last.t > 0 && Math.hypot(x - last.x, y - last.y) / dt > MAX_SPEED) {
      ts.length = 0
      xs.length = 0
      ys.length = 0
    } else if (moving && last.t > 0 && last.t - last.moved >= STILL && ts.length > 1) {
      const keep = ts.length - 1
      ts.copyWithin(0, keep)
      xs.copyWithin(0, keep)
      ys.copyWithin(0, keep)
      ts.length = xs.length = ys.length = 1
    }
    if (moving) last.moved = time
    last.t = time
    last.x = x
    last.y = y
    ts.push(time)
    xs.push(x)
    ys.push(y)
    let old = 0
    while (old < ts.length && ts[old] < time - WINDOW) old++
    if (old > 0) {
      ts.copyWithin(0, old)
      xs.copyWithin(0, old)
      ys.copyWithin(0, old)
      ts.length -= old
      xs.length -= old
      ys.length -= old
    }

    // Without a lead it is where the browser says, as it is: a frame behind, by the same amount for as long as the speed
    // holds, which the eye doesn't see. The fit is only for the speed. Drawn where a fitted line is, the glass trailed
    // the page as a scroll started and ran past it as it stopped (the line bends late), a swing of up to 40px in a few
    // frames that read as a bounce on every turn of a mouse wheel.
    const since = time - last.moved
    if (lead <= 0 || since >= STILL || ts.length < 2) return result(x, y)
    const vx = fit(ts, xs)
    const vy = fit(ts, ys)
    const speed = Math.hypot(vx, vy)
    const k = lead * ramp(speed)
    // A frame without news is a late report or a stop. Slow, there is no telling them apart yet: the first is let be,
    // and from the second what is ahead fades out, so a stop doesn't overshoot for long. Fast, the page would have moved
    // a few px in that time, and the browser reports every frame of that: it stopped (a finger caught a flick), so
    // nothing is drawn ahead from that frame on.
    const fade =
      since > 0 && speed * since > MISSED ? 0 : since < QUIET ? 1 : Math.max(0, 1 - (since - QUIET) / (STILL - QUIET))
    // Ahead at that speed. Not along the curve: it keeps the acceleration of the finger past the moment it lets go, and
    // overshot there by twice as much
    return result(x + vx * k * fade, y + vy * k * fade)
  }
}
