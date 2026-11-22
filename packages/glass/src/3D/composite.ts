import { EDGE, SRGB } from "./displacement"

// What is behind a higher layer of glass: the page, and the glass of the layers below it as it is on the screen. It is
// drawn in screen space, over the region the glass of the layer covers (and as far around it as its frost reaches),
// in sRGB values blended the way the browser blends them, which the glass of the layer then reads back.
//
// The same is drawn behind any glass an animated layer of the page (`glass-layer`) is under, on every frame it moves:
// what is under the layers, the layers where they are, then what is in front of them.

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
  /** What the page has in front of its animated layers, on nothing, not premultiplied (see \`over\` of the snapshot) */
  uniform highp sampler2D uOver;
  /** 0: the page. 1: what is under its layers, worked out from the two. 2: what is in front of them, premultiplied */
  uniform int uMode;
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
    if (uMode == 0) {
      fragColor = vec4(encodeSRGB(texture(uPage, uv).rgb), 1.0);
      return;
    }
    // A pixel each of the two, the same one, not a blend of the pixels around it: what is under the layers is worked
    // out from both, which a blend at the edges of what is in front (text) would throw off.
    ivec2 size = textureSize(uPage, 0);
    ivec2 texel = clamp(ivec2(uv * vec2(size)), ivec2(0), size - 1);
    vec4 over = texelFetch(uOver, texel, 0);
    vec3 front = encodeSRGB(over.rgb) * over.a;
    if (uMode == 2) {
      fragColor = vec4(front, over.a);
      return;
    }
    // The page is what is in front over what is under, blended as the browser blends, in sRGB values: so what is
    // under is what is left of the page once that is taken out. Where what is in front covers it, it doesn't matter.
    vec3 base = encodeSRGB(texelFetch(uPage, texel, 0).rgb);
    vec3 under = over.a < 0.995 ? clamp((base - front) / (1.0 - over.a), 0.0, 1.0) : base;
    fragColor = vec4(under, 1.0);
  }
`

/**
 * An animated layer of the page (\`glass-layer\`), where it is drawn on this frame: its picture, as big as its box and
 * the margin around it, through the linear part of its transform, around the center of its box
 */
export const LAYER_VERTEX = /* glsl */ `#version 300 es
  in vec2 aPos;
  /** The center of its box on the screen, y down, its transform included */
  uniform vec2 uCenter;
  /** Half the size of its picture, in px */
  uniform vec2 uHalf;
  /** Its transform without the move: x' = a x + c y, y' = b x + d y, y down */
  uniform vec4 uMatrix;
  uniform vec4 uRegion;
  out vec2 vUv;
  void main() {
    vec2 local = vec2(aPos.x, -aPos.y) * uHalf;
    vec2 screen = uCenter + vec2(uMatrix.x * local.x + uMatrix.z * local.y, uMatrix.y * local.x + uMatrix.w * local.y);
    vec2 region = vec2(screen.x - uRegion.x, uRegion.y + uRegion.w - screen.y);
    gl_Position = vec4(region / uRegion.zw * 2.0 - 1.0, 0.0, 1.0);
    // the picture is flipped: its top row is at the top of the texture
    vUv = aPos * 0.5 + 0.5;
  }
`

export const LAYER_FRAGMENT = /* glsl */ `#version 300 es
  precision highp float;
  /** Premultiplied, in sRGB values */
  uniform highp sampler2D uPicture;
  uniform float uOpacity;
  in vec2 vUv;
  out vec4 fragColor;
  void main() {
    fragColor = texture(uPicture, vUv) * uOpacity;
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
  /** What the glass drew, its own size, in sRGB values, saturated */
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
  in vec2 vLocal;
  out vec4 fragColor;
${EDGE}
  void main() {
    // the glass, cut to its shape with a pixel of softness, as the browser clips it
    float inside = clamp(edge(vLocal, uDrawn * 0.5, uRadius, uExp).x + 0.5, 0.0, 1.0);
    vec3 glass = texture(uGlass, vLocal / uDrawn + 0.5).rgb;
    vec4 color = vec4(glass * inside, inside);
    if (uHasOverlay) {
      vec4 over = texture(uOverlay, (vLocal / uScale) / uOverlaySize + 0.5);
      color = over + (1.0 - over.a) * color;
    }
    fragColor = color;
  }
`
