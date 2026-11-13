# How the glass works

This is the internals guide. The [README](../README.md) covers what you can do with `<Glass>`; this covers how it is
drawn, so you can change the engine without breaking it. The code it describes is in `packages/glass/src`.

## Contents

1. [The idea](#the-idea)
2. [Map of the code](#map-of-the-code)
3. [A glass in the DOM](#a-glass-in-the-dom)
4. [Choosing 3D or CSS](#choosing-3d-or-css)
5. [The picture of the page (snapshot)](#the-picture-of-the-page-snapshot)
6. [The frame loop](#the-frame-loop)
7. [The renderer and its passes](#the-renderer-and-its-passes)
8. [The glass shader](#the-glass-shader)
9. [Layers](#layers)
10. [Getting pixels back to the DOM](#getting-pixels-back-to-the-dom)
11. [Scroll prediction](#scroll-prediction)
12. [When a glass is redrawn](#when-a-glass-is-redrawn)
13. [Lifecycle and failure modes](#lifecycle-and-failure-modes)
14. [Coordinate conventions](#coordinate-conventions)
15. [Rules that are easy to break](#rules-that-are-easy-to-break)

## The idea

A browser cannot give a page element a refracting backdrop: `backdrop-filter` can blur and saturate but cannot
displace. So the engine does it itself:

1. Take a **picture of the whole page** (an SVG `foreignObject` drawn into a canvas). This is the **snapshot**.
2. Upload it to the GPU once as a texture.
3. For each glass, run a **fragment shader** that reads that texture around where the glass sits. Near the rim it reads
   from further inside (the **displacement profile**), which bends the page at the edge of the glass.
4. Put the result in a `<canvas>` behind the element's children. Tint, rim, stroke and shadow are plain DOM/CSS on top.

Everything else in the codebase exists to keep that cheap and in step with the page: one GL context for all glass, a
single frame loop, captures that don't block the page, scroll prediction, and caching so a still glass costs nothing.

The glass samples a *picture*, not the live page. That is why a video or a hover under it is stale until the next
capture, and why glass can't see other glass without the [layer](#layers) machinery.

## Map of the code

| File | Role |
| --- | --- |
| `glass-provider.tsx` | `GlassProvider`: owns the snapshot, counts how many glasses want it, exposes it by context. |
| `context.ts` | The three contexts: `GlassContext` (snapshot, enabled, `want`, `scrollLead`), `GlassNestContext`, `GlassLayerContext`. |
| `glass.tsx` | `Glass` and `GlassLayer`. Decides 3D vs CSS, builds the DOM, wires press and bounds. |
| `3D/index.tsx` | `Glass3D`: the canvas, and the `frame()` callback that tells the renderer where the glass is and how to draw it. |
| `3D/renderer.ts` | `GlassRenderer`: the single WebGL2 context, all the passes, caching, layers, copy-out. |
| `3D/displacement.ts` | The GLSL for the glass and the blur, the sRGB helpers, and `profileUniforms` (config to uniforms). |
| `3D/composite.ts` | The GLSL for the backdrop of higher layers: the page pass and the lower-glass composite pass. |
| `3D/fallback.tsx` | `GlassFallback`: the CSS glass (`backdrop-filter`). |
| `edge.tsx` | `GlassEdge` (rim and stroke) and `GlassShadow`, shared by both versions. |
| `utils/snapshot.ts` | `snapshot()` (the page) and `snapshotElement()` (one element, for layers). |
| `utils/hooks.ts` | `usePageSnapshot`, `useMotionBounds`, `useInView`, `useComputedStyle`, `useIncreasedContrast`. |
| `utils/frames.ts` | The one `requestAnimationFrame` loop: read, commit, draw. Also the frame time and last scroll input behind `autoLead()`. |
| `utils/predict.ts` | Scroll prediction (`createPredictor`). |
| `utils/capability.ts` | One-off GPU benchmark whose verdict is cached in `localStorage`. |
| `utils/press.ts` | Hover, press and drag for `interactive` glass. Writes `translate`, `scale` and `--glass-lit` directly. |
| `utils/theme.ts`, `utils/style.ts` | Theme from color; reading `border-radius` and `corner-shape`. |
| `types/schemas.ts`, `presets.ts` | The Zod config schema and the presets. |

## A glass in the DOM

One `<Glass>` renders this (`glass.tsx`):

```
div  [glass-ignore]  position: relative            <- the element; `outer`; the "element" the renderer is given
├─ GlassShadow                                       shadow cast below the glass (outside the clip)
├─ div.content   absolute, inset 0, overflow:hidden, border-radius + corner-shape   <- the clip; `ref` of useMotionBounds
│   ├─ Glass3D  -> <canvas>                          what the renderer draws (or GlassFallback in CSS mode)
│   ├─ div.tint                                       color-mix(color, tint.opacity)   (3D only)
│   └─ GlassEdge                                      rim + stroke
└─ children                                          inside GlassNestContext = true
```

Points that matter:

- **`glass-ignore`** makes the snapshot hide the element (`visibility: hidden !important` on it and its subtree) while
  it keeps its place in the layout. This is how the glass doesn't capture itself. Canvases are hidden the same way.
- The **canvas is the size of the element's layout box** (`offsetWidth/Height`, floored) but is *displayed* at the
  size the element is drawn at, transforms included (a press scales it). The shader works in drawn-size pixels, so a
  pixel of the picture is a pixel of the screen. See [Coordinate conventions](#coordinate-conventions).
- The **clip** (border radius + `corner-shape`) does the final shaping. The shader draws the full rectangle; the
  corners are cut by CSS, not by the shader. (The composite pass for layers does cut with `edge()`, since it has no CSS to
  clip it, see [Layers](#layers).)
- **Tint, rim, stroke, shadow are DOM**, not shader work. The 3D glass is lit (hover, pressed) with a `filter` on the
  content layer using `--glass-lit`; the CSS glass puts the light on its own parts instead, because a `filter` on a
  parent would cut a child's `backdrop-filter` off from the page. That is what the `lit` prop is.

## Choosing 3D or CSS

`Glass` computes `wants3D` (`glass.tsx`). All of these must hold:

- not nested inside another glass (`GlassNestContext`). A nested glass is *always* CSS, even with `force3D`: the 3D
  glass bends the page picture, which has no glass in it, so it would show the page straight through its parent;
- the provider is `enabled`, and no ancestor has `data-glass-off` (read when the glass first comes into view);
- the glass is in view (`useInView`, 200px margin);
- and either `force3D`, or: not `disable3D`, no `prefers-reduced-motion`, no `prefers-contrast: more`, and
  `useGlassCapability() === true`.

It then draws in 3D only if it also has a snapshot (`do3D = wants3D && snapshot`). Until the first capture finishes,
and whenever any condition fails, it is the CSS glass.

`wants3D` also registers the glass with the provider (`want()`), which is what turns capturing on. The page is only
captured while at least one glass wants it, so a page of CSS-only glass never pays for a capture.

### Device capability

`utils/capability.ts` runs once per device, when the browser is idle (`requestIdleCallback`, 3s timeout). It:

1. asks for a WebGL2 context with `failIfMajorPerformanceCaveat: true`, which fails on software renderers;
2. times a 512x512 fullscreen draw of a 128-iteration trig loop (2 warm-up frames, then the median of 8, forced to
   finish by `readPixels`); the device passes if the median is at most 8ms.

The verdict is stored in `localStorage` under `polinetwork-glass:capable` with a `VERSION` that must be bumped when the
benchmark or its threshold changes. Until there is a verdict, glass stays CSS.

## The picture of the page (snapshot)

`usePageSnapshot` (`utils/hooks.ts`) owns capturing, `snapshot()` (`utils/snapshot.ts`) does it.

### How a capture works

The page is drawn the way `html-to-image` does it: an SVG image whose `foreignObject` holds a copy of the page. The
difference is how the copy is styled. `html-to-image` wrote the computed style of every element onto the copy (hundreds
of property reads per element, ~150ms of frozen page on the demo). Here the copy **keeps its classes and gets the
page's own stylesheets**, so the browser styles it as it styles the page, and the work left is a clone and a
serialization.

An SVG image is a sealed document, and it sees the page differently. Each difference has a fix in `snapshot.ts`:

| Difference | Fix |
| --- | --- |
| An SVG image loads nothing. | Images, fonts and CSS `url()`s are fetched once and inlined as data URLs (`toDataUrl`, cached in `inlined`). Failures are retried up to `TRIES` times. |
| Its viewport is the whole page, so `vh`/`vw` are wrong. | `measureViewport()` finds the real unit sizes (plain, small, large, dynamic) with a probe element; `fixViewport()` rewrites them to px in declarations only, not in selectors. `<html>` copy gets the page's width. |
| Its `:root` is the `<svg>`. | `fixSelector()` rewrites `:root` to `:is(:root, html)`. |
| Scripts don't run. | `<script>`, `<noscript>`, `<style>` and stylesheet `<link>` are removed from the copy. |
| Its media queries are evaluated against the SVG, not the window (no scrollbar, so breakpoints can differ). | `@media` rules are evaluated on the page via `matchMedia` and inlined if they hold; the query itself is dropped. `onMediaChange` triggers a new capture when one flips. |
| Properties that aren't attributes (loaded `src`, form values, `srcset`). | `copyState()` copies them; lazy images that haven't loaded are dropped. |
| Only loaded fonts matter. | `loadedFonts()` filters `@font-face` rules to `status === "loaded"`, and keeps only the first `src`. |
| Photos far bigger than they are shown would cost encoding, decoding and drawing on every capture. | `fitImage()` redraws an image at the largest power-of-two fraction of its size that still covers its box (JPEG stays JPEG, else PNG) and caches it by size, so it is redone only when the image's size on the page halves or doubles. Images less than 2x oversized, and `object-fit: none/scale-down`, are left alone. |
| Page background can extend beyond `<html>`. | `canvasColors()` fills the canvas with the browser canvas color and the root/body background first. |
| A canvas can only be a texture if untainted. | The SVG is a `data:` URL, not a `blob:` URL, because Chrome taints a canvas that draws a `foreignObject` SVG from a blob. |

Other details: stylesheets are processed once per sheet (`prepared`, keyed on rule count, fonts, viewport, and media
state); cross-origin sheets are fetched as text and rewritten whole; the provider's `blur` is applied as a CSS `filter`
on the copy, which is why it is shared by all glass. A page bigger than `MAX_TEXTURE_SIZE` is drawn smaller and
stretched back.

The `Snapshot` carries `{ canvas, width, height, fresh }`. `width/height` are the page's CSS size, which can differ
from the canvas size when scaled down. `fresh` means the capture inlined a resource for the first time (or one failed):
WebKit can draw an SVG before its images are decoded, so a `fresh` capture is taken again 400ms later (`RETAKE_MS`).

### When it is captured again

`usePageSnapshot` re-captures when: `deps` or `blur` change; the page's `scrollWidth/Height` change
(`ResizeObserver` on `<html>`); an `<img>` loads or fonts finish (settled over `LOAD_SETTLE_MS` = 150ms so a burst is
one capture); or a media query of the page flips.

**One capture runs at a time.** A request during a capture sets `again`, and one more capture runs after it, a frame
later (`afterNextFrame`). Without that gap the capture's microtasks never let the page paint, and a window resize would
freeze the page. The result of a capture that ends after the glass was turned off is discarded.

### Freeing it

A snapshot is a canvas as big as the page, plus a GPU copy. iOS counts canvases against a memory cap, so
`releaseSnapshot()` drops the GPU texture and sets the canvas to 0x0 as soon as nothing draws it. `usePageSnapshot`
calls it when a snapshot is replaced. `Glass3D` keeps the latest props in a ref and updates it in a layout effect so
the renderer never draws a snapshot after it was freed.

## The frame loop

`utils/frames.ts` runs **one** `requestAnimationFrame` loop for the whole library, and only while something uses it.
Each frame:

```
frameScroll.x/y = window.scrollX/Y        (read from the window, not scroll events: overscroll can move it silently)
for each watcher: commit = read()         READ phase   getBoundingClientRect of every watched glass (useMotionBounds)
for each commit:  commit()                COMMIT phase writes motion values
for each drawer:  draw(time)              DRAW phase   the renderer draws, from what was just read
```

Reads before writes means one glass updating doesn't force a layout for the next. Drawing in the *same* frame as the
reads means the glass is never a frame behind. `watchFrames` registers a reader, `drawFrames` registers a drawer; the
renderer registers itself with `drawFrames` when its first glass is added and unregisters with its last.

`useMotionBounds(watch)` is the reader. While a glass is drawn in 3D it reads the element's rect every frame and
commits only if it changed (`sameRect`, 0.01px tolerance), so things that move a glass without a scroll (a press, a CSS
transition, a layout shift) are followed. A CSS glass only reads its size on a `ResizeObserver`.

## The renderer and its passes

`3D/renderer.ts` has a single `GlassRenderer` (created lazily by `getRenderer()`, `null` if WebGL2 is missing, which
makes `Glass3D` render the CSS glass). One context for all glass, because a context per glass:

- held its own copy of the page texture (contexts share nothing) and re-uploaded it on every capture;
- hit the browser's context cap (Chrome keeps 16 and silently drops the oldest, so that glass goes blank).

It draws into an `OffscreenCanvas` (or a regular canvas where that doesn't exist). It does not ask for `powerPreference: "high-performance"`: on a laptop with two GPUs that would wake the discrete one for what is one texture read per pixel.

### Programs

`compile()` links five programs (all share one full-screen quad, `QUAD`):

| Program | Shaders | Purpose |
| --- | --- | --- |
| `glass` | `VERTEX` + `fragment(false)` | The glass over a texture the GPU decodes (the page, or a blur of it). |
| `glassOnBackdrop` | `VERTEX` + `fragment(true)` | The same, for a backdrop of raw sRGB values (layers > 0): decodes by hand. |
| `blur` | `BLUR_VERTEX` + `BLUR_FRAGMENT` | One direction of a Gaussian. |
| `page` | `PAGE_VERTEX` + `PAGE_FRAGMENT` | Layers: draws the region of the page into a backdrop. |
| `composite` | `GLASS_VERTEX` + `GLASS_FRAGMENT` | Layers: draws one lower glass (and its overlay) into a backdrop. |

### Passes, in the order a frame can run them

```
snapshot canvas ──upload (once per capture)──▶ [page texture]  (SRGB8_ALPHA8, flipped, no mipmaps)
                                                    │
        (1) FROST  blur across ─▶ blur down         │   once per (snapshot, sigma), cached, reused by every glass
                                                    ▼
        (2) GLASS  one pass per glass that changed ─▶ [that glass's own texture]  (kept in entry.output)
                                                    │
        (3) SHOW   blit every drawn glass side by side onto the shared canvas
                   ─▶ one ImageBitmap ─▶ drawImage into each glass's 2D canvas
```

For layers above 0, two more passes run *before* (2) for that glass: **(0a) page** and **(0b) composite**, then its
frost is blurred from that backdrop, see [Layers](#layers).

**(1) Frost.** `surface.frost` is a blur of what is behind the glass. Instead of averaging around each pixel of each
glass every frame (25 reads/pixel, 75 with dispersion), the *page* is blurred once per `sigma = frostSigma(frost)`
(`frost * 0.9`, fitted to the disc average this replaced) and every glass just reads the blurred texture once. `blurInto()` does a separable Gaussian: across into
an intermediate target, then down. Details:

- each tap pair is fetched with one read between two texels, letting bilinear filtering do the weighting;
- it runs in linear light and writes to an `SRGB8_ALPHA8` target, which stores it encoded;
- the result is kept at `blurScale(sigma)` of the source size (a power of two such that the blur is still at least 2px
  wide), since a blurred picture has no detail finer than its blur. It is stretched back when read;
- blurs are cached per snapshot per sigma (`blurs`), and `release(snapshot)` drops them.

With `frost === 0` the glass reads the raw page texture.

**(2) Glass.** `drawGlass()` draws into a texture of the glass's own size (`target(entry.output, w, h, exact)`), with
`viewport` at the layout size. The fragment shader is in [the next section](#the-glass-shader). Each glass keeps its
output texture between frames: it is what a higher layer composites, and what lets a glass that didn't change be
skipped.

**(3) Show.** See [Getting pixels back to the DOM](#getting-pixels-back-to-the-dom).

> The CSS glass converts `frost` to a CSS `blur()` with its own factor (`FROST_TO_BLUR = 1.5` in `3D/fallback.tsx`),
> fitted separately so that the two look alike. Change one and re-check the other against it.
>
> The same goes for `lift`: a backdrop filter has no gamma, so `liftFilter` in `3D/fallback.tsx` stands in for the
> shader's `pow` with a `contrast()` and a `brightness()`, which can only scale and offset. It fits the line `c + a·x`
> to `x^lift` by relative error, so the shadows come out right (black rises by about 0.06, where a fit over the whole
> range would raise it by 0.17 and wash a dark page to gray) at the cost of highlights running slightly light. Checked
> on a page of `#030512` under the dark glass: the shader gives about `(36,39,54)` and the CSS glass `(39,42,54)`.

## The glass shader

`fragment(encoded)` in `3D/displacement.ts`. For each pixel, `vPos` is its position in px from the center of the glass,
at the size the glass is drawn.

1. **Edge distance.** `edge(p, halfSize, radius, exponent)` returns, for the rounded box, how far *in* from the nearest
   edge the point is (`x`, negative outside) and the outward normal at that edge (`yz`). In the corner regions it uses
   a **superellipse** (`pow(pow(q.x,n)+pow(q.y,n), 1/n)`); `n = 2` is a normal circle, larger `n` is the squircle
   (`corner-shape`). Elsewhere it is the plain distance to the side. This function is shared with the composite pass so
   both agree on the shape.
2. **Profile.** Within the bezel, `mag = (1 - inward / bezel) ^ curve`, which is 0 where the bezel meets the flat face
   and 1 at the rim. Outside the bezel `mag = 0`: the face is flat, with no displacement.
3. **Bend.** The sample position is `vPos - normal * shift * mag`: at the rim the pixel shows what is `shift` px
   *further in*. Where `shift` outruns the curve, the outer band folds over and shows what is deeper in, like the curved
   edge of real glass.
4. **Dispersion.** If `dispersion > 0` and `mag > 0`, red samples at `bend * (1 + d)` and blue at `bend * (1 - d)`.
   Three reads only inside the bezel; the face is a single read.
5. **Color.** Output is `toSRGB(color)`, then CSS-compatible `saturate()` if `uSaturate != 1`. Saturation is done here
   because applying it as a CSS filter on the canvas costs an extra pass every frame.
6. **Lift.** If `uLift != 1`, `pow(max(srgb, 0), uLift)`, after the saturation and before the tint (a CSS layer over the
   canvas), so the glass is the tint color over the backdrop raised to `lift`. Below 1 it raises the shadows and keeps
   the whites: Apple's dark glass is about 0.67. The `max` keeps a saturation that overshoots below 0 from making
   a NaN.

`sampleAt(p)` maps glass-space `p` to the texture: `uv = (p - uBg) / uTexSize + 0.5`. `uBg` is where the *center of the
texture* is relative to the glass center (y up). For the page that is `[pageW/2 - cx, cy - pageH/2]`, computed in
`Glass3D`; for a backdrop it is computed in `drawGlass`. `uTexSize` is the page size or the backdrop size.

### `profileUniforms`

`profileUniforms()` turns the config and the geometry into uniforms:

- the glass can be **drawn bigger or smaller than its box** (press, stretch, transforms); `radius` scales with the average
  of the two ratios and is clamped to half the shortest side;
- the profile was fitted on controls about 64px wide, where 25px of shift is a lot. Past 64px,
  `grow = (shortSide / 64) ** shape.scaling` multiplies `bezel` and `shift` (this is `shape.scaling`);
- `bezel` is clamped to `[1, half]` and `shift` to `[0, half]`, so a very small glass is all bend and never samples
  past its middle.

### Color handling

The page texture is `SRGB8_ALPHA8`, so the GPU decodes it to linear on read, and the filtering is done in linear light. The
shader re-encodes on write with `toSRGB` (three.js's curve, which the glass has always used). Backdrops for layers > 0 are
plain `RGBA8` holding *already encoded* values (so blending composes the way the browser blends), which is why the
`encoded` variant decodes by hand (`decodeSRGB`) and `blurInto` takes an `encoded` flag. Mixing these up gives washed out
or crushed colors.

## Layers

By default a glass bends the page picture, which contains no glass. So glass on glass shows the page through, not the
glass below. **Layers** fix that for floating things (a player over a card, a bubble over a fixed header).

- Layer 0 (default) is drawn exactly as above and costs nothing extra if nothing uses another layer.
- A glass on layer *n > 0* bends **what is behind it on screen**: the page plus every glass on lower layers, as those
  were drawn, together with what each has *over* its glass (tint, edges, text).
- `layer` says what a glass *sees*, not where it is painted: the element still has to be above in `z-index`.

`GlassRenderer.draw()` processes layers from the bottom up; `below` accumulates the glass of the layers already
processed. For each glass of layer > 0, `backdrop(glass, below, scrollX, scrollY)` builds its backdrop:

1. **Region.** The screen rectangle the glass covers, grown by its frost's blur reach (`3 * sigma`) plus
   `BACKDROP_MARGIN` (4px). **Per glass**, not per layer: a fixed header and a fixed tab bar together would be the whole
   screen, redrawn every scroll frame, while on their own they are two strips.
2. **Which lower glass.** Only those overlapping the region, sorted by layer then document order
   (`followsInDocument`). If none, it returns `null` and the glass bends the page like layer 0.
3. **Overlay of each lower glass.** `overlay()` ensures there is a *picture of the element* with its content but without
   the glass behind it, taken with `snapshotElement()`, which clones the element into empty copies of its ancestors
   (`data-glass-shell`, with background, transform and filters neutralised, so only the element's own look remains), its
   canvas and shadow hidden, in a transparent SVG with `OVERLAY_MARGIN` (8px) of room for overflow. It is taken the
   first time it is needed and again when a `MutationObserver` or `ResizeObserver` says the element changed (its own
   `style` and canvas changes don't count: a press writes those every frame). Only one element picture is taken at a
   time, and a `fresh` one is retaken after 400ms. None is taken while the page scrolls faster than `CAPTURE_SPEED`
   (0.5px/ms) or for `CALM` (100ms) after: each lays out and paints a copy of the element with all of the page's CSS on
   the main thread, and a flick ran the header and tab bar into a new caption bar every 50ms or so, a megabyte a second
   of garbage. Until then the lower glass shows without its overlay, while it moves too fast to read.
4. **What it is drawn from.** Region, scroll, snapshot, and for each lower glass its entry, draw version, key, center
   and overlay version, written over the values of the last frame in `entry.drawnFrom`, one at a time (`put`). If none
   changed, nothing is drawn: it is reused. Otherwise `backdrop.version` takes a new number (unique across the
   renderer), which is what the glass drawn on it compares.
5. **Draw.** Into a per-glass backdrop target (which only grows):
   - **page pass**: the page, offset by scroll, over the region, encoded to sRGB;
   - **composite pass**: each lower glass's `output` texture, cut to its shape with `edge()` and a pixel of softness, and the
     overlay on top, premultiplied, with blending `ONE, ONE_MINUS_SRC_ALPHA`.
6. **Frost.** If `frost > 0`, the backdrop is blurred for that glass alone (`blurInto(..., encoded = true, entry.across,
   entry.frosted)`), since unlike the page it isn't shared. Otherwise it is read directly (`glassOnBackdrop`).

Then the glass is drawn with the `glassOnBackdrop` program, with `uBg` computed from the region (the region sits at the
bottom left of a texture that may be bigger than it).

What a higher layer doesn't see of the glass below: its shadow, its pressed light, and the blur of CSS glass (nested glass,
`disable3D`), which it sees as tint only.

## Getting pixels back to the DOM

The renderer can't just hand each glass its own canvas: a canvas can't be shared between contexts, and per-glass WebGL
canvases would bring the context cap back. So (`show()`):

1. The glasses drawn this frame are laid out **side by side in rows** on the renderer's canvas (rows wrap at 2048px
   or the widest glass). An OffscreenCanvas is sized to exactly that on every frame: its bitmap (step 3) takes its
   buffer and it gets a new one as big as itself either way, so one grown once for every glass on the page (1819x352
   on a phone, at load) was 2.5MB of bitmap on every frame of a scroll that only redraws the header and the tab bar,
   against about 250KB sized to them. Safari counts every bitmap as memory to collect, and that size of it ran a full
   collection, 40–60ms with nothing drawn, about every 220ms of a flick. A plain `<canvas>` (no OffscreenCanvas) is
   copied from directly and only ever grows, since there resizing is what costs.
2. Each glass's `output` is `blitFramebuffer`'d into its slot. GL counts rows from the bottom, hence the flip in the
   slot's y.
3. The canvas is taken **as one bitmap** (`transferToImageBitmap()`) and each glass's own 2D canvas gets a `drawImage`
   of its piece. One bitmap, not one copy per glass: Firefox reads a WebGL canvas back to the CPU on every copy (137ms
   a frame for 16 glasses, against 12ms with one bitmap). In Chrome either is a fraction of a millisecond.
4. A glass's 2D canvas is resized only when its size changed (resizing clears it; it is drawn right after).

Only the glasses that were drawn *this frame* go through `show()`; the others keep what their canvas shows.

## Scroll prediction

Browsers scroll off the page's thread and tell the page about it a frame later. The page under a glass that stays on
screen is therefore drawn where it *was*, a frame behind. `utils/predict.ts` draws it ahead, by a lead in ms. With
`scrollLead` unset the lead comes from `autoLead()` in `utils/frames.ts`: a frame of the display (the rAF interval,
smoothed) when the last scroll input was a `touchstart`, and 0 when it was a `wheel` (before any input, a coarse
pointer counts as touch). A flick decelerates smoothly, which the lead follows; a wheel stops dead, which it overshoots,
so there the glass uses the scroll position as reported, and the lag holds still while the speed does. The predictor:

- keep the last 80ms of `(time, position)` and fit a **parabola** (least squares) for the **speed**, read at the latest
  sample: a line's slope is the speed of half a window ago, so it trailed a flick as it sped up (in a simulated 60Hz
  flick, by 35px against 18px). Only the speed is used: the lead is added to the position as the browser reports it,
  not to where the curve is (a fitted line bends late, so drawn where it is, the glass trailed the page by up to 40px as
  a scroll started and ran past it as it stopped, even with no lead), and not along the curve either (it carries the
  finger's acceleration past the release);
- a scroll that starts after a stop (50ms still) drops the still samples from the window, which would otherwise read as
  a slower speed;
- the lead is `scrollLead * ramp(speed)`: nothing under 0.25px/ms, full at 0.8px/ms, smoothstep in between, so a slow
  scroll (the one you inspect the glass in) is drawn exactly and the lead comes in with speed;
- a jump over 12px/ms (`scrollTo`, anchor) resets the window and isn't followed;
- a frame without news is a stop when at the speed read the point would have moved more than 3px in that time (a finger
  catching a flick): the lead drops at once. Slower, it may be a late report: one for 25ms is left; after that the lead
  fades out by 50ms, so a stop doesn't overshoot for long.

There are two predictors with different meanings. In `renderer.draw()` one predicts the **page scroll** (used for layers,
which work in screen space). In `Glass3D.frame()` each glass has its own that predicts its **page position**
(`scroll + rect`): for a glass that stays in place on screen, that moves with the scroll, and for a glass that scrolls
with the page it doesn't move at all, so no prediction is applied, which is right because the browser moves it itself.
Measured in Chrome at 120Hz during a 2000px/s scroll that stops dead: no lead holds a steady 15px (a frame) behind;
8ms of lead is within a px while moving, but trails by up to 29px as it starts and overshoots by 13px as it stops,
which is why a wheel gets no lead by default. The lag is a frame and not a fixed time, which is why the automatic lead is
the measured frame and not a number of ms.

## When a glass is redrawn

A glass pass is skipped when everything it was last drawn with is the same (`draw()`):

```
entry.generation === renderer.generation   (the GL context hasn't been restored since)
entry.key        === state.key             (see below)
entry.snapshot   === state.snapshot        (no new capture)
entry.backdrop   === backdrop.version      (0 for layer 0)
and entry.output exists
```

`state.key` is a number (`nextKey()`) that `Glass3D.frame` takes anew whenever what the glass is drawn from changes:
drawn size, layout size, center (so `bg`, the page position of the glass), snapshot, layer, border radius, corner
exponent, frost, saturate, lift, and the shape config (by value: a new object with the same values is the same shape).
While none of them changes, `frame()` hands back **the same state object**: it runs for every glass on every frame, and
a new state with its key string and uniforms each time was garbage Safari collected in 30–60ms pauses, about every
1.5s with the page still and about every 250ms while it scrolled, which is the glass stopping behind the page. The
lead isn't part of it (it is the measured frame, a little different on every one, and doesn't change what is drawn).

Because the center is in it, a glass that **stays on screen** while the page scrolls is redrawn every frame, and one
that **scrolls with the page** is not (its center on the page doesn't change). That's the main reason a page of
scrolling content with lots of glass costs nothing while it scrolls.

`entry.version` increments on each draw; a higher layer's backdrop compares the versions of the glass below, which is
how it knows to redraw when one of them did.

The frame loop allocates as little as it can for the same reason: `draw()` keeps its lists and one `Glass` per entry
from frame to frame, the predictor keeps plain number arrays and hands back the same pair, and the frame loop in
`frames.ts` keeps its list of commits. In headless Chrome on the showcase this took allocation from 675 to 207KB/s at
rest and from 3.3 to 1.5MB/s while scrolling.

Off screen glass (`useInView`, 200px margin) isn't in the renderer at all.

## Lifecycle and failure modes

- **Add/remove.** `renderer.add(target)` returns a disposer. The first glass starts the frame loop, the last stops it.
  `free(entry)` deletes that glass's GPU targets and disconnects its observers.
- **Context loss.** On `webglcontextlost` the renderer prevents the default (so it can come back) and stops drawing. On
  `webglcontextrestored` it clears every GPU resource, recompiles, and bumps `generation`, so every glass redraws.
- **No WebGL2 / compile error.** `getRenderer()` returns `null` and every `Glass3D` renders the fallback.
- **Capture failure.** A failed page capture keeps the previous picture. A failed element capture leaves that lower glass
  without its overlay.
- **SSR.** `getRenderer()` is `null` without `document`; the capability store and `localStorage` access are guarded.

## Coordinate conventions

This is where most bugs come from. Four spaces are in play:

| Space | Origin | Y | Units | Where |
| --- | --- | --- | --- | --- |
| Page (CSS) | top left of the document | down | px | `snapshot.width/height`, `center`, `bg` inputs |
| Screen | top left of the viewport | down | px | `center - scroll`; `backdrop.region` |
| Glass | center of the glass | **up** | px, at the *drawn* size | `vPos`, `bg`, `uBg` |
| Texture / GL | bottom left | up | uv 0..1 or px | uploads (flipped), framebuffers |

- The page texture is uploaded with `UNPACK_FLIP_Y_WEBGL`, so its first row is the *bottom* of the page.
- `bg` is "where the page's center is, from the glass center, y up": `[pageW/2 - cx, cy - pageH/2]`. The opposite signs
  are because page y points down and glass y points up.
- A backdrop target only grows, and its region lives at the *bottom left* of the texture. `uBg` in `drawGlass` accounts for that.
- GL counts rows from the bottom everywhere: `gl_FragCoord`, `blitFramebuffer`, `viewport`. The `show()` slot flip and the
  `PAGE_FRAGMENT` `uRegion.y + uRegion.w - gl_FragCoord.y` are this.
- Layout size (`offsetWidth`) vs drawn size (`getBoundingClientRect`): the canvas has the first, the shader works in the second.

## Rules that are easy to break

- **The snapshot must not contain glass.** Anything that draws glass must carry `glass-ignore`. `<Glass>` does it itself.
- **Don't add per-frame DOM reads outside `watchFrames`.** Reads go in the read phase, writes in commit, GL in draw.
- **Don't create a second WebGL context for drawing.** (`capability.ts` makes a throwaway one for the benchmark;
  `snapshot.ts` makes one to read `MAX_TEXTURE_SIZE`, and loses it right away.)
- **Never read a texture that is also the framebuffer target.** Backdrop, `across` and `down` are separate targets for this reason.
- **sRGB discipline** (see Color handling). A texture is either decoded by the GPU or by hand, never both.
- **Cache keys must include everything that changes the pixels.** If you add a uniform that varies per glass, add
  what it comes from to what `Glass3D.frame` compares (`made`), or the glass won't redraw when it changes.
- **Don't allocate in the frame loop.** No new arrays, objects, closures or strings per glass per frame where one kept
  from the last frame will do: Safari collects that garbage in 30–60ms pauses, and the glass stops behind the page.
- **Add GPU resources to `free()` and to the context-restored reset** or they leak / dangle after a restore.
- **A bump in the benchmark needs a `VERSION` bump** in `capability.ts`.
