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
| `interactive` | For glass that is a control. It lifts on hover (1.045), snaps down (0.94) and is lit (brighter, more saturated) while pressed, and when dragged it stretches toward the pointer with an elastic falloff and squashes across, then springs back. A drag is a gesture, so the click that would follow it is swallowed (a tap still clicks). A press that starts on a link or button inside the glass is theirs. With `prefers-reduced-motion` it doesn't move, and is only lit. Default `false`. |
| `claimTouch` | For an interactive glass above the content (a fixed header, a popover): a touch on it never scrolls what is under it. Otherwise a touch on the glass still scrolls the page, and the press carries on while it does. |
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
| `apple` | The `apple` refraction profile (see [Refraction profiles](#refraction-profiles)), drawn flat. |

## Configuration

All the fields have defaults, and the demo (`pnpm dev`) has a control for each.

| Field | Range | Default | |
| --- | --- | --- | --- |
| `material` | | | Props of drei's [`MeshTransmissionMaterial`](https://github.com/pmndrs/drei#meshtransmissionmaterial). |
| `plane.blur` | 0 – 100 | 2 | Blur of the background (see `GlassProvider`). |
| `shape.profile` | `mesh` `apple` | `mesh` | How the glass bends what is behind it, see [Refraction profiles](#refraction-profiles). |
| `shape.bezel` | 1 – 64 | 16 | Width of the bent band at the edge in px. Fixed for `mesh`; `apple` grows it with the element (`shape.scaling`). |
| `shape.depth` | 0 – 64 | 16 | `mesh`: how far the bevel rises from the face. More bends the backdrop more. |
| `shape.curve` | 0.5 – 6 | 2.5 | How the bend grows toward the rim. Higher keeps the face flat longer and bends more at the edge. Both profiles. |
| `shape.shift` | 0 – 64 | 25 | `apple`: how far in from the rim the very edge samples, in px. |
| `shape.scaling` | 0 – 1 | 0.4 | `apple`: how much `bezel` and `shift` grow on elements whose shortest side is over 64px (the size the profile was fitted on): they are multiplied by `(side / 64) ** scaling`. 0 keeps them as set. |
| `shape.dispersion` | 0 – 1 | 0 | `apple`: how much further the red bends than the blue, which splits the colors at the rim. |
| `shape.dispersionRim` | 0 – 1 | 0 | `mesh`: where the chromatic aberration (`material.chromaticAberration`) is: 0 spreads it evenly over the glass, 1 puts it all at the rim, where the surface is curved. |
| `shape.lens` | -0.3 – 0.3 | 0 | `mesh`: bends the face like a lens: positive magnifies what is behind the glass, negative shrinks it. |
| `tint.opacity` | 0 – 1 | 0 | How much of `color` is laid over the glass. |
| `tint.saturate` | 0.5 – 3 | 1 | Saturation of what is seen through the glass. |
| `edge.rim` | 0 – 1 | 1 | Strength of the highlight on the edges. |
| `edge.stroke` | 0 – 1 | 1 | Strength of the hairline stroke around the glass. |
| `edge.elevation` | `low` `default` `high` `extra-high` | `default` | How high the glass floats, which shapes the shadow it casts. |
| `edge.shadow` | 0 – 1 | 1 | Strength of that shadow. |
| `edge.presence` | 0 – 1 | 0 | A faint, tight shadow kept at every elevation, for glass that would read flat. |
| `lighting` | | | The ambient and directional lights of the scene. |

A glass inside another glass dims its shadow, which lands on a lighter surface.

### Refraction profiles

`shape.profile` picks how the glass bends the page behind it.

- **`mesh`** (default): the glass is a bevelled 3D mesh, and drei's transmission shader refracts the background through
  it. It has lights, sheen, clearcoat and roughness (the `material` and `lighting` fields), and the bend depends on
  `ior`, `thickness` and the bevel.
- **`apple`**: the background is sampled through a displacement profile fitted to recordings of Apple's Liquid Glass
  (the one of [Vitrium](https://github.com/SummaCristian/Vitrium)): inside a `bezel` wide band at the rim each point shows what is up to
  `shift` px further in, growing as `t ** curve` toward the rim, and the middle is flat. Where the shift outruns the
  curve the outer part of the band folds over and shows what is deeper in, as the curved edge of a real slab of glass
  does. It is drawn flat: there is no shading (the rim, stroke and shadow of `edge` stand in for it), so `material`,
  `lighting`, `depth`, `lens` and `dispersionRim` have no effect.

They are different recipes, not the same one tuned: measured on a gradient background, the displacement of `apple` goes
21, 15, 10, 6, 3, 1 px at 1, 3, 5, 7, 9, 11 px from the rim (the formula), while `mesh` with the demo's values goes 90,
82, 71, 48, 29, 10, and no `ior`, `thickness` or `curve` makes it follow the other: the transmission shader saturates at
the steep angles of the rim, so it has a plateau at the edge and a shorter tail.

## Performance

- **On screen only.** A glass gets its WebGL canvas when it comes within 200px of the screen and loses it when it leaves.
- **Device check.** The first time glass is used the device is measured when the browser is idle (a WebGL2 context that
  refuses software renderers, then a few frames of a workload shaped like the glass), and the verdict is kept in
  `localStorage`. Until it is known, and where it is a no, the CSS glass is used. `force3D` skips it.
- **Opt out.** `<GlassProvider enabled={false}>` for everything, or `data-glass-off` on any ancestor of a glass for a
  region of the page (read when the glass comes into view).

## Things to know

- The shadow reaches outside of the glass, so a parent that clips overflow (`overflow: hidden`) cuts it off.
- `shape.dispersionRim` (mesh) changes the shader of drei's `MeshTransmissionMaterial`, so it depends on how that writes it. If a
  version of drei writes it differently the glass keeps its even aberration.
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
