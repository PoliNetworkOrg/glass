# glass
apple could never

Liquid glass for the web: the page behind an element is captured as a texture and bent at the edges of the glass by a
displacement profile fitted to Apple's Liquid Glass (WebGL2), with a CSS version where that can't be used.

```tsx
import { Glass, GlassProvider, glassPresets, glassTints } from "@polinetwork/glass"

<GlassProvider deps={[theme]} blur={2}>
  <Glass color="#F8FAFC" options={glassPresets.regular} className="rounded-3xl p-6">
    <h1>Hello Glass</h1>
  </Glass>
</GlassProvider>
```

The glass takes its shape from the element: its `border-radius` (px or `%`) and its `corner-shape`
(`squircle`, `superellipse(K)`) are read from the computed style. It follows the element as it resizes, in real time.

## `<GlassProvider>`

Captures the page as the texture all the glass inside it refracts, while a glass inside it is drawn in 3D. It is
captured again when `deps` or `blur` change, when the page changes size, and when an image or a font finishes loading.

| Prop | |
| --- | --- |
| `deps` | When any of them changes the background is captured again (the theme, for example). |
| `blur` | Blur of the captured background, in px. It is shared by all the glass in the provider, so `plane.blur` of a glass's options takes effect only where the app passes it here. |
| `enabled` | `false` turns the 3D glass off for the whole tree and stops capturing. Default `true`. |
| `scrollLead` | How far ahead, in ms, the 3D glass draws the page while the page moves under it, to make up for the browser telling the page it scrolled after it did. Default `16`, a frame, which is what Chrome needs. `0` turns it off. |

Elements with a `glass-ignore` attribute, and canvases, are left out of the capture. `<Glass>` sets it on itself.

## `<Glass>`

A `div` (it takes the usual props) with the glass drawn behind its children.

| Prop | |
| --- | --- |
| `options` | The [configuration](#configuration) of the glass, or a [preset](#presets). |
| `color` | The color of the glass: laid over it by `tint.opacity`, and the base of the CSS version. For `regular` and `clear` use `glassColors.light` or `glassColors.dark`, the neutral glass measured on Apple's tab bar. |
| `theme` | `light` or `dark`, which sets the light on the edges. By default it follows the lightness of `color`. |
| `interactive` | For glass that is a control. It lifts on hover (1.045), snaps down (0.94) and is lit (brighter, more saturated) while pressed, and when dragged it stretches toward the pointer with an elastic falloff and squashes across, then springs back. A drag is a gesture, so the click that would follow it is swallowed (a tap still clicks). A press that starts on a link or button inside the glass is theirs. With `prefers-reduced-motion` it doesn't move, and is only lit. Default `false`. |
| `claimTouch` | For an interactive glass above the content (a fixed header, a popover): a touch on it never scrolls what is under it. Otherwise a touch on the glass still scrolls the page, and the press carries on while it does. |
| `layer` | The [layer](#layers) of the glass. Default: the one of the `<GlassLayer>` it is in, or 0. |
| `force3D` | Draw the 3D glass even where the device was judged too slow for it, or the user asked for less motion. |
| `disable3D` | Always use the CSS glass. |

The CSS glass has the same blur (`surface.frost` and `plane.blur`), saturation and tint as the 3D one, so the three
presets look alike in both, but it can't bend what is behind it: a CSS backdrop filter has no displacement. It is used
until the background is captured, while the glass is far off screen, and where the 3D one isn't
available: with `prefers-reduced-motion` or `prefers-contrast: more`, when the device is too slow (see
[Performance](#performance)), or when it is turned off.

## Layers

The glass bends a picture of the page, which has no glass in it: a glass doesn't see another glass. Where one floats
over another (a bubble over a fixed header, a player over a card) put it on a higher layer, and it bends what is
behind it on the screen, the glass below included, with what that glass has over it (its tint, its edges, its text).

```tsx
<Glass layer={1} ...>  {/* one glass */}

<GlassLayer layer={1}>  {/* everything in a floating part of the page */}
  <Glass ...>Now playing</Glass>
</GlassLayer>
```

The glass of layer 0, all of it unless it is told otherwise, is drawn as it always was, and a page that uses no other
layer pays nothing for them. For a higher layer the renderer draws what is behind it, over the region of the screen
the layer covers, from the page and from what the glass below drew last, with a picture of what each has over its
glass, taken the first time a layer above needs it and again when the element changes. It is drawn again only when
something in that region moved or changed. The layer has to be drawn above the ones below too (its `z-index`): the
layer says what the glass sees, not where it is drawn.

What a higher layer doesn't see of the glass below: its shadow, its light while pressed, and the blur of glass drawn
with CSS (nested glass, `disable3D`), which it sees through the glass it is in, tinted but not blurred. The demo's
Showcase puts up to 32 glass orbs moving on layer 1, over 48 glasses on layer 0: Chrome keeps 60fps, 58 while
scrolling.

## Presets

`glassPresets` holds ready made options, and `withPreset` changes some of one:

```tsx
<Glass options={glassPresets.clear} color="#F8FAFC" />
<Glass options={glassPresets.tinted} color={glassTints.blue} />
<Glass options={withPreset("tinted", { tint: { opacity: 0.5 } })} color="#3b6175" />
```

| | |
| --- | --- |
| `regular` | The default: a light frost (2px) under a strong tint (66%) of the glass color, as measured on Apple's tab bar. |
| `clear` | Half the frost and tint, the colors behind pushed up (saturation 1.8), to get out of the way of what is behind it. |
| `tinted` | Colored glass: its color is the `color` of the glass. `glassTints` has ready made ones (`blue`, `teal`, `green`, `yellow`, `orange`, `red`, `pink`, `purple`), `blue` being the one to start from. |

## Configuration

All the fields have defaults, and the demo's Playground (`pnpm dev`, then `#/playground`) has a control for each. The
demo opens on its Showcase: a made up magazine built with the glass (a floating header, controls over photos, a player,
a tab bar), with a panel of live numbers and moving glass to load it with.

| Field | Range | Default | |
| --- | --- | --- | --- |
| `plane.blur` | 0 – 100 | 0 | Blur of the captured background (see `GlassProvider`). |
| `shape.bezel` | 1 – 64 | 16 | Width of the bent band at the edge, in px. |
| `shape.shift` | 0 – 64 | 25 | How far in from the rim the very edge samples, in px. |
| `shape.curve` | 0.5 – 6 | 2.5 | How the bend grows toward the rim. Higher keeps the face flat longer and bends more at the edge. |
| `shape.scaling` | 0 – 1 | 0.4 | How much `bezel` and `shift` grow on elements whose shortest side is over 64px (the size the profile was fitted on): they are multiplied by `(side / 64) ** scaling`. 0 keeps them as set. |
| `shape.dispersion` | 0 – 1 | 0 | How much further the red bends than the blue, which splits the colors at the rim. |
| `surface.frost` | 0 – 32 | 2 | How much the glass blurs what is behind it, in px. Per glass, on top of `plane.blur`. |
| `tint.opacity` | 0 – 1 | 0.66 | How much of `color` is laid over the glass. |
| `tint.saturate` | 0.5 – 3 | 1 | Saturation of what is seen through the glass. |
| `edge.rim` | 0 – 1 | 1 | Strength of the highlight on the edges. |
| `edge.stroke` | 0 – 1 | 1 | Strength of the hairline stroke around the glass. |
| `edge.elevation` | `low` `default` `high` `extra-high` | `default` | How high the glass floats, which shapes the shadow it casts. |
| `edge.shadow` | 0 – 1 | 1 | Strength of that shadow. |
| `edge.presence` | 0 – 1 | 0 | A faint, tight shadow kept at every elevation, for glass that would read flat. |

A glass inside another glass (a lens in a segmented control, a button on a panel) is always the CSS glass, `force3D` or
not: the 3D glass bends the picture of the page, which has no glass in it, so nested it would show the page through its
parent. The CSS glass blurs and tints what is really behind it, its parent included, which is what glass on glass looks
like. Give it a lighter tint than its parent so it reads as a layer on it. Its shadow is dimmed, as it lands on a
lighter surface.

### Refraction

The background is sampled through a displacement profile fitted to recordings of Apple's Liquid Glass (the one of
[Vitrium](https://github.com/SummaCristian/Vitrium)): inside a `bezel` wide band at the rim each point shows what is up
to `shift` px further in, growing as `t ** curve` toward the rim, and the middle is flat. Where the shift outruns the
curve the outer part of the band folds over and shows what is deeper in, as the curved edge of a real slab of glass
does. Measured on a gradient background it goes 21, 15, 10, 6, 3, 1 px at 1, 3, 5, 7, 9, 11 px from the rim.

The glass is drawn flat: there is no shading, and the rim, stroke and shadow of `edge` stand in for it. It is not
a 3D mesh with a transmission material, which was tried first and abandoned: its shader saturates at the steep angles
of the rim and no `ior` or `thickness` made it follow this profile.

## Performance

- **Capture.** The page is drawn as an SVG image of a copy of it that keeps its classes and gets the page's own
  stylesheets (with viewport units, `:root`, fonts and images carried over), not the computed style of every element:
  about 15ms on the demo in Chromium and 20ms in Firefox, without blocking the page. Images, fonts and stylesheets are
  inlined once and kept. The page is only captured while some glass is drawn in 3D, so a page whose glass is all CSS
  never pays for it. One capture runs at a time, with a frame drawn between two of them, so while a window is resized
  the glass follows it at about a capture a frame without holding the page's frames back.
- **One renderer.** All the glass on the page, of all its layers, is drawn by a single WebGL2 context, which holds the picture of the page
  on the GPU once and uploads it once per capture. Each frame the glasses that changed are drawn side by side on its
  canvas, which is taken as one bitmap and copied, a piece to each, to the canvas the glass shows. A context per glass
  held a copy of the picture each and ran into the browser's cap on contexts (16 in Chrome, past which the oldest are
  dropped); with one, 24 glasses on a 1280x6000 page cost about 0.5ms a frame in Chrome. In Firefox, which reads the
  bitmap back to the CPU, it is about 4ms a frame for one glass and 12ms for 16 while they move, and nothing while they
  don't.
- **On screen only.** A glass draws when it comes within 200px of the screen and stops when it leaves.
- **Device check.** The first time glass is used the device is measured when the browser is idle (a WebGL2 context that
  refuses software renderers, then a few frames of a workload shaped like the glass), and the verdict is kept in
  `localStorage`. Until it is known, and where it is a no, the CSS glass is used. `force3D` skips it.
- **Follows the element.** While a glass is drawn it reads where its element is on every frame (one shared loop, a
  single batched read for all the glass) and redraws only when that changed. So whatever moves it without a scroll,
  its own press and stretch, a CSS transition or animation, a layout shift, the glass keeps the page lined up behind
  it. The scroll position is read from the window each frame too, not only from scroll events, and the glass is drawn
  in that same frame. The browser scrolls the page off the page's thread and tells the page a frame or more later, so
  the glass draws the page where it is going, at the speed it moves, `scrollLead` ms ahead (see `GlassProvider`).
  In Chrome, during a 2500px/s scroll, that takes the glass from 41px behind the page to within a few px of it.
- **Opt out.** `<GlassProvider enabled={false}>` for everything, or `data-glass-off` on any ancestor of a glass for a
  region of the page (read when the glass comes into view).

## Things to know

- The shadow reaches outside of the glass, so a parent that clips overflow (`overflow: hidden`) cuts it off.
- Where the browser bounces the page when it is pulled past its end and doesn't say so in the scroll position
  (Firefox), the picture in the 3D glass stays where it is while the page bounces. Safari does say so, and there the
  glass follows the bounce. To turn the bounce off: `html { overscroll-behavior: none; }`.
- `corner-shape` isn't supported everywhere yet, where it isn't the corners are round.
- The 3D glass shows the page as it was captured, so what changes under it (a video, an animation, a hover) isn't
  reflected until the next capture. Canvases, videos, iframes and the scroll of inner scrollers aren't in the capture.

## TODO:
- [ ] reactify the thingy
  - [ ] Error boundaries and Suspense to handle delays
- [x] make it responsive
  - [x] redo the screenshot on resize
  - [x] make it work on zoom
- [x] create the geometry
  - [x] box with rounded edges via path extrude
  - [ ] maybe vector math in rust in WASM?
- [x] do the glass thing
  - [x] frost !
  - [x] refraction
  - [x] reflection
  - [x] fresnel 
  - [x] chromatic aberration ?
- [ ] performance
  - [x] check webgl support
  - [ ] make sure it does not explode (like profiling maybe?)
- [x] accessibility
  - [x] stop it when user has reduced motion enabled
  - [x] increased contrast ?
