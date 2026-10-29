import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { frameScroll } from "../utils/frames"
import { createPredictor } from "../utils/predict"
import type { Snapshot } from "../utils/snapshot"
import { profileUniforms } from "./displacement"
import { GlassFallback, type GlassFallbackProps } from "./fallback"
import { getRenderer } from "./renderer"

export type Glass3DProps = GlassFallbackProps & {
  /** The picture of the page, which is what gets bent */
  snapshot: Snapshot
  /** How far ahead, in ms, the page is drawn while it moves under the glass */
  scrollLead?: number
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
    let last = ""
    let lastSnapshot: Snapshot | null = null
    return renderer.add({
      canvas: el,
      frame: (time, force) => {
        const p = current.current
        const { width: w, height: h, layoutWidth, layoutHeight, left, top } = p.bounds.get()
        if (w <= 0 || h <= 0 || layoutWidth <= 0 || layoutHeight <= 0) return null
        // Where the center of the glass is on the page, and where it will be when this frame is on screen. It is what
        // moves with the scroll for a glass that stays in place on the screen, and what doesn't for one that scrolls
        // with the page, which is drawn in place by the browser itself.
        const [cx, cy] = predict(time, frameScroll.x + left + w / 2, frameScroll.y + top + h / 2, p.scrollLead ?? 0)
        // Where the center of the page is, from the center of the glass, y up: that much to its left, and the same
        // distance above it. The two come out with opposite signs because y up is the other way from the page's.
        const bg: [number, number] = [p.snapshot.width / 2 - cx, cy - p.snapshot.height / 2]
        const { shape, surface } = p.scene
        const key = `${w} ${h} ${layoutWidth} ${layoutHeight} ${bg[0]} ${bg[1]} ${p.borderRadius} ${p.cornerExponent} ${surface.frost} ${JSON.stringify(shape)}`
        if (key === last && p.snapshot === lastSnapshot && !force) return null
        last = key
        lastSnapshot = p.snapshot
        return {
          snapshot: p.snapshot,
          width: Math.floor(layoutWidth),
          height: Math.floor(layoutHeight),
          uniforms: profileUniforms(
            w,
            h,
            layoutWidth,
            layoutHeight,
            bg,
            p.borderRadius,
            p.cornerExponent ?? 2,
            shape,
            surface.frost
          ),
        }
      },
    })
  }, [renderer])

  if (!renderer) return <GlassFallback {...props} />

  const { tint } = props.scene
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
        filter: tint.saturate !== 1 ? `saturate(${tint.saturate})` : undefined,
        boxShadow: "0 0 8px rgba(0, 0, 0, 0.1)",
      }}
    />
  )
}
