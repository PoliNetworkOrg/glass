import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef } from "react"
import type { ShapeConfig } from "../types/schemas"
import { autoLead, frameScroll } from "../utils/frames"
import { createPredictor } from "../utils/predict"
import type { Snapshot } from "../utils/snapshot"
import { profileUniforms } from "./displacement"
import { GlassFallback, type GlassFallbackProps } from "./fallback"
import { type GlassState, getRenderer, nextKey } from "./renderer"

export type Glass3DProps = GlassFallbackProps & {
  /** The picture of the page, which is what gets bent */
  snapshot: Snapshot
  /** How far ahead, in ms, the page is drawn while it moves under the glass. Unset, see `autoLead` */
  scrollLead?: number
  /** The layer of the glass: the glass of a higher layer bends the glass below it, see `layer` of the glass */
  layer?: number
  /** The element of the glass, whose picture is what the glass of a higher layer sees of it over its glass */
  element: RefObject<HTMLElement | null>
}

/**
 * # Glass3D
 * The glass in WebGL: a canvas the size of the box of the element, which the shared renderer draws the page into, bent
 * at the rim. It is drawn on screen by the element's transform (a press scales it), so the view it shows is as big as
 * the element is drawn, which makes a pixel of the picture a pixel of the screen.
 *
 * Where the device has no WebGL2 it is the CSS glass.
 */
export function Glass3D(props: Glass3DProps) {
  const renderer = useMemo(getRenderer, [])
  const canvas = useRef<HTMLCanvasElement>(null)

  // Read on every frame, outside of React. It is handed over as soon as it is committed, before the provider frees the
  // picture it replaces (in an effect, after this one)
  const current = useRef(props)
  useLayoutEffect(() => {
    current.current = props
  })

  useEffect(() => {
    const el = canvas.current
    if (!renderer || !el) return
    const predict = createPredictor()
    // The state of the last frame, and what it was made of. While that is the same, so is the state, and the same object
    // is handed back: this runs for every glass on every frame, and a new state with its key and its uniforms each time
    // was garbage that Safari collected in pauses of 30 to 60ms, with the page still and nothing to draw.
    let state: GlassState | null = null
    const made = {
      snapshot: null as Snapshot | null,
      layer: 0,
      element: null as HTMLElement | null,
      w: 0,
      h: 0,
      layoutWidth: 0,
      layoutHeight: 0,
      cx: 0,
      cy: 0,
      radius: 0,
      exponent: 0,
      shape: null as ShapeConfig | null,
      frost: 0,
      saturate: 0,
      lift: 0,
    }
    /** The shape as JSON: a new object with the same values (a render of the glass) is the same shape */
    let shapeJson = ""
    return renderer.add({
      canvas: el,
      frame: (time) => {
        const p = current.current
        const element = p.element.current
        const { width: w, height: h, layoutWidth, layoutHeight, left, top } = p.bounds.get()
        if (!element || w <= 0 || h <= 0 || layoutWidth <= 0 || layoutHeight <= 0) return null
        const lead = p.scrollLead ?? autoLead()
        // Where the center of the glass is on the page, and where it will be when this frame is on screen. It is what
        // moves with the scroll for a glass that stays in place on the screen, and what doesn't for one that scrolls
        // with the page, which is drawn in place by the browser itself.
        const [cx, cy] = predict(time, frameScroll.x + left + w / 2, frameScroll.y + top + h / 2, lead)
        const { shape, surface, tint } = p.scene
        const layer = p.layer ?? 0
        const exponent = p.cornerExponent ?? 2
        if (made.shape !== shape) {
          const json = JSON.stringify(shape)
          if (json === shapeJson) made.shape = shape
          else shapeJson = json
        }
        if (
          state &&
          made.snapshot === p.snapshot &&
          made.layer === layer &&
          made.element === element &&
          made.w === w &&
          made.h === h &&
          made.layoutWidth === layoutWidth &&
          made.layoutHeight === layoutHeight &&
          made.cx === cx &&
          made.cy === cy &&
          made.radius === p.borderRadius &&
          made.exponent === exponent &&
          made.shape === shape &&
          made.frost === surface.frost &&
          made.saturate === tint.saturate &&
          made.lift === tint.lift
        ) {
          // the lead is the measured frame, a little different on every one, and isn't part of what is drawn
          state.lead = lead
          return state
        }
        made.snapshot = p.snapshot
        made.layer = layer
        made.element = element
        made.w = w
        made.h = h
        made.layoutWidth = layoutWidth
        made.layoutHeight = layoutHeight
        made.cx = cx
        made.cy = cy
        made.radius = p.borderRadius
        made.exponent = exponent
        made.shape = shape
        made.frost = surface.frost
        made.saturate = tint.saturate
        made.lift = tint.lift
        // Where the center of the page is, from the center of the glass, y up: that much to its left, and the same
        // distance above it. The two come out with opposite signs because y up is the other way from the page's.
        const bg: [number, number] = [p.snapshot.width / 2 - cx, cy - p.snapshot.height / 2]
        state = {
          snapshot: p.snapshot,
          layer,
          element,
          width: Math.floor(layoutWidth),
          height: Math.floor(layoutHeight),
          drawn: [w, h],
          center: [cx, cy],
          lead,
          saturate: tint.saturate,
          lift: tint.lift,
          uniforms: profileUniforms(
            w,
            h,
            layoutWidth,
            layoutHeight,
            bg,
            p.borderRadius,
            exponent,
            shape,
            surface.frost
          ),
          key: nextKey(),
        }
        return state
      },
    })
  }, [renderer])

  if (!renderer) return <GlassFallback {...props} />

  return (
    <canvas
      ref={canvas}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        margin: "auto",
        borderRadius: 5,
        zIndex: -1,
        // nothing in it is interactive
        pointerEvents: "none",
        boxShadow: "0 0 8px rgba(0, 0, 0, 0.1)",
      }}
    />
  )
}
