import { EDGE, SRGB } from "./displacement"

// What is behind a higher layer of glass: the page, and the glass of the layers below it as it is on the screen. It is
// drawn in screen space, over the region the glass of the layer covers (and as far around it as its frost reaches),
// in sRGB values blended the way the browser blends them, which the glass of the layer then reads back.

/** The page, where it is on the screen: a rectangle over the whole region */
export const PAGE_VERTEX = /* glsl */ `#version 300 es
  in vec2 aPos;
  void main() {
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`

export const PAGE_FRAGMENT = /* glsl */ `#version 300 es
  precision highp float;
  uniform highp sampler2D uPage;
  uniform vec2 uPageSize;
  /** The region on the screen, in px: x, y (from the top left) and its width and height */
  uniform vec4 uRegion;
  /** Where the page is scrolled */
  uniform vec2 uScroll;
  out vec4 fragColor;
${SRGB}
  void main() {
    // GL counts rows from the bottom of the region
    vec2 screen = vec2(uRegion.x + gl_FragCoord.x, uRegion.y + uRegion.w - gl_FragCoord.y);
    vec2 page = screen + uScroll;
    // the picture of the page is flipped, its first row is the bottom of the page
    vec2 uv = vec2(page.x / uPageSize.x, 1.0 - page.y / uPageSize.y);
    fragColor = vec4(encodeSRGB(texture(uPage, uv).rgb), 1.0);
  }
`

/** A glass of a lower layer: a rectangle over where it is drawn, with room around it for what overflows it */
export const GLASS_VERTEX = /* glsl */ `#version 300 es
  in vec2 aPos;
  /** The center of the glass on the screen, y down */
  uniform vec2 uCenter;
  /** Half the size of the rectangle, in px */
  uniform vec2 uHalf;
  uniform vec4 uRegion;
  /** px from the center of the glass, y up */
  out vec2 vLocal;
  void main() {
    vLocal = aPos * uHalf;
    vec2 screen = uCenter + vec2(vLocal.x, -vLocal.y);
    vec2 region = vec2(screen.x - uRegion.x, uRegion.y + uRegion.w - screen.y);
    gl_Position = vec4(region / uRegion.zw * 2.0 - 1.0, 0.0, 1.0);
  }
`

export const GLASS_FRAGMENT = /* glsl */ `#version 300 es
  precision highp float;
  /** What the glass drew, its own size, in sRGB values */
  uniform highp sampler2D uGlass;
  /** The picture of what the element has over its glass (its tint, its edges, what is in it), premultiplied */
  uniform highp sampler2D uOverlay;
  uniform bool uHasOverlay;
  /** The size the glass is drawn at, transforms included */
  uniform vec2 uDrawn;
  /** How much bigger it is drawn than its box, on each axis */
  uniform vec2 uScale;
  /** The size of the picture of what is over it: the box of the element and the margin around it */
  uniform vec2 uOverlaySize;
  uniform float uRadius;
  uniform float uExp;
  /** The saturate() filter of its canvas */
  uniform float uSaturate;
  in vec2 vLocal;
  out vec4 fragColor;
${EDGE}
  // CSS's saturate(), on sRGB values as the browser applies it
  vec3 saturateCss(vec3 c, float s) {
    mat3 m = mat3(
      0.213 + 0.787 * s, 0.213 - 0.213 * s, 0.213 - 0.213 * s,
      0.715 - 0.715 * s, 0.715 + 0.285 * s, 0.715 - 0.715 * s,
      0.072 - 0.072 * s, 0.072 - 0.072 * s, 0.072 + 0.928 * s
    );
    return clamp(m * c, 0.0, 1.0);
  }

  void main() {
    // the glass, cut to its shape with a pixel of softness, as the browser clips it
    float inside = clamp(edge(vLocal, uDrawn * 0.5, uRadius, uExp).x + 0.5, 0.0, 1.0);
    vec3 glass = texture(uGlass, vLocal / uDrawn + 0.5).rgb;
    if (uSaturate != 1.0) glass = saturateCss(glass, uSaturate);
    vec4 color = vec4(glass * inside, inside);
    if (uHasOverlay) {
      vec4 over = texture(uOverlay, (vLocal / uScale) / uOverlaySize + 0.5);
      color = over + (1.0 - over.a) * color;
    }
    fragColor = color;
  }
`
