# glass
apple could never

Liquid glass for the web: the page behind an element is captured as a texture and refracted through a real 3D glass
(Three.js, with a transmission material), with a CSS version where that can't be used.

```tsx
import { Glass, GlassProvider, glassPresets } from "@polinetwork/glass"

<GlassProvider deps={[theme]} blur={2}>
  <Glass color="#F8FAFC" options={glassPresets.regular} className="rounded-3xl p-6">
    <h1>Hello Glass</h1>
  </Glass>
</GlassProvider>
```

The glass takes its shape from the element: its `border-radius` (px or `%`) and its `corner-shape`
(`squircle`, `superellipse(K)`) are read from the computed style. It follows the element as it resizes, in real time.

## `<GlassProvider>`

Captures the page as the texture all the glass inside it refracts. It is captured again when `deps` change or the page
resizes, which is the expensive part.

| Prop | |
| --- | --- |
| `deps` | When any of them changes the background is captured again (the theme, for example). |
| `blur` | Blur of the captured background, in px. It is shared by all the glass in the provider, so `plane.blur` of a glass's options takes effect only where the app passes it here. |
| `enabled` | `false` turns the 3D glass off for the whole tree and stops capturing. Default `true`. |

Elements with a `glass-ignore` attribute, and canvases, are left out of the capture. `<Glass>` sets it on itself.

## `<Glass>`

A `div` (it takes the usual props) with the glass drawn behind its children.

| Prop | |
| --- | --- |
| `options` | The [configuration](#configuration) of the glass, or a [preset](#presets). |
| `color` | The color of the glass: laid over it by `tint.opacity`, and the base of the CSS version. |
| `theme` | `light` or `dark`, which sets the light on the edges. By default it follows the lightness of `color`. |
| `force3D` | Draw the 3D glass even where the device was judged too slow for it, or the user asked for less motion. |
| `disable3D` | Always use the CSS glass. |

The CSS glass is used until the background is captured, while the glass is far off screen, and where the 3D one isn't
available: with `prefers-reduced-motion` or `prefers-contrast: more`, when the device is too slow (see
[Performance](#performance)), or when it is turned off.

## Presets

`glassPresets` holds ready made options, and `withPreset` changes some of one:

```tsx
<Glass options={glassPresets.clear} color="#F8FAFC" />
<Glass options={withPreset("tinted", { tint: { opacity: 0.5 } })} color="#3b6175" />
```

| | |
| --- | --- |
| `regular` | The glass as it comes. |
| `clear` | Less frost and tint, to get out of the way of what is behind it. |
| `tinted` | Colored glass: its color is the `color` of the glass. |

## Configuration

All the fields have defaults, and the demo (`pnpm dev`) has a control for each.

| Field | Range | Default | |
| --- | --- | --- | --- |
| `material` | | | Props of drei's [`MeshTransmissionMaterial`](https://github.com/pmndrs/drei#meshtransmissionmaterial). |
| `plane.blur` | 0 – 100 | 2 | Blur of the background (see `GlassProvider`). |
| `shape.bezel` | 1 – 64 | 16 | Width of the beveled edge in px. Fixed: it doesn't scale with the element. |
| `shape.depth` | 0 – 64 | 16 | How far the bevel rises from the face. More bends the backdrop more. |
| `shape.curve` | 0.5 – 6 | 2.5 | How the bevel slopes toward the rim. Higher keeps the face flat longer and bends more at the edge. |
| `shape.lens` | -0.3 – 0.3 | 0 | Bends the face like a lens: positive magnifies what is behind the glass, negative shrinks it. |
| `tint.opacity` | 0 – 1 | 0 | How much of `color` is laid over the glass. |
| `tint.saturate` | 0.5 – 3 | 1 | Saturation of what is seen through the glass. |
| `edge.rim` | 0 – 1 | 1 | Strength of the highlight on the edges. |
| `edge.stroke` | 0 – 1 | 1 | Strength of the hairline stroke around the glass. |
| `edge.elevation` | `low` `default` `high` `extra-high` | `default` | How high the glass floats, which shapes the shadow it casts. |
| `edge.shadow` | 0 – 1 | 1 | Strength of that shadow. |
| `edge.presence` | 0 – 1 | 0 | A faint, tight shadow kept at every elevation, for glass that would read flat. |
| `lighting` | | | The ambient and directional lights of the scene. |

A glass inside another glass dims its shadow, which lands on a lighter surface.

## Performance

- **On screen only.** A glass gets its WebGL canvas when it comes within 200px of the screen and loses it when it leaves.
- **Device check.** The first time glass is used the device is measured when the browser is idle (a WebGL2 context that
  refuses software renderers, then a few frames of a workload shaped like the glass), and the verdict is kept in
  `localStorage`. Until it is known, and where it is a no, the CSS glass is used. `force3D` skips it.
- **Opt out.** `<GlassProvider enabled={false}>` for everything, or `data-glass-off` on any ancestor of a glass for a
  region of the page (read when the glass comes into view).

## Things to know

- The shadow reaches outside of the glass, so a parent that clips overflow (`overflow: hidden`) cuts it off.
- `corner-shape` isn't supported everywhere yet, where it isn't the corners are round.
- The 3D glass shows the page as it was captured, so what changes under it (a video, an animation) isn't reflected until
  the next capture.

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
