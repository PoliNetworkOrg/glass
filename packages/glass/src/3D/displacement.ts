import type { ShapeConfig } from "../types/schemas"

// The glass of the `apple` profile: the page behind is sampled through a displacement profile instead of being
// refracted by a mesh. Near the rim of the glass the backdrop is pulled in from further inside, by an amount that grows
// toward the rim, and the middle is left flat. The profile was extracted from recordings of Apple's Liquid Glass (see
// Vitrium), where the rim also folds over: its outer band shows what is deeper in, as the curved edge of real glass
// does.
//
// It is drawn flat, so it has none of the shading of a mesh (lights, sheen, clearcoat, roughness), which the edge of
// the glass (rim, stroke, shadow) stands in for.

/** The shortest side, in px, of the controls the apple profile was fitted on */
const FITTED_SIZE = 64

/** A rectangle that covers the view, as a strip of 4 points */
export const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])

export const VERTEX = /* glsl */ `#version 300 es
  in vec2 aPos;
  uniform vec2 uSize;
  out vec2 vPos;
  void main() {
    // the rectangle covers the view, which is as big as the element is drawn: this is the position in px from its center
    vPos = aPos * 0.5 * uSize;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`

/** How far in from the rim of a box, and which way is out: shared by the glass and by what composes the layers */
export const EDGE = /* glsl */ `
  // x: how far in from the nearest edge (negative outside), yz: that edge's outward normal, for the point p (px from
  // the center) of a box of half size halfSize with corners of radius r and superellipse exponent n
  vec3 edge(vec2 p, vec2 halfSize, float r, float n) {
    vec2 q = abs(p) - (halfSize - r);
    float inward;
    vec2 nrm;
    if (q.x > 0.0 && q.y > 0.0) {
      float len = n == 2.0 ? length(q) : pow(pow(q.x, n) + pow(q.y, n), 1.0 / n);
      inward = r - len;
      vec2 g = n == 2.0 ? q : pow(q, vec2(n - 1.0));
      nrm = g / max(length(g), 1e-6);
    } else if (q.x > q.y) {
      inward = r - q.x;
      nrm = vec2(1.0, 0.0);
    } else {
      inward = r - q.y;
      nrm = vec2(0.0, 1.0);
    }
    return vec3(inward, nrm * sign(p + vec2(1e-6)));
  }
`

/** The sRGB curves: three.js's, which the glass has always been written with, and the exact ones */
export const SRGB = /* glsl */ `
  vec3 toSRGB(vec3 c) {
    return mix(pow(c, vec3(0.41666)) * 1.055 - vec3(0.055), c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));
  }
  vec3 encodeSRGB(vec3 c) {
    return mix(1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));
  }
  vec3 decodeSRGB(vec3 c) {
    return mix(pow((c + 0.055) / 1.055, vec3(2.4)), c / 12.92, vec3(lessThanEqual(c, vec3(0.04045))));
  }
`

/**
 * The glass. With the offset the profile gives the point (nothing past the bezel, and inside it the sample is taken
 * from further in, never past the edge where the backdrop ends, by an amount that grows toward the rim as t ** curve,
 * t being 0 where the bezel meets the face and 1 at the rim), the backdrop is read, frosted, and written in sRGB.
 *
 * @param encoded The backdrop is a texture of sRGB values that the GPU doesn't decode (what is behind a higher
 * layer), and not the picture of the page (an sRGB texture, read in linear light)
 */
export const fragment = (encoded: boolean) => /* glsl */ `#version 300 es
  precision highp float;
  precision highp int;

  uniform highp sampler2D uMap;
  uniform vec2 uTexSize;
  uniform vec2 uBg;
  uniform vec2 uSize;
  /** Where the glass starts in the canvas it is drawn on, so its grain doesn't depend on where that is */
  uniform vec2 uOrigin;
  uniform float uRadius;
  uniform float uExp;
  uniform float uBezel;
  uniform float uShift;
  uniform float uCurve;
  uniform float uDispersion;
  uniform float uFrost;
  in vec2 vPos;
  out vec4 fragColor;
${EDGE}
${SRGB}
  vec3 sampleAt(vec2 p) {
    vec2 uv = (p - uBg) / uTexSize + 0.5;
    return ${encoded ? "decodeSRGB(texture(uMap, uv).rgb)" : "texture(uMap, uv).rgb"};
  }

  // the backdrop averaged over a disc of radius uFrost px: taps on a spiral that covers it evenly, turned a little
  // differently at every pixel so that what is left of the taps is grain and not a ghost of the image
  vec3 frosted(vec2 p) {
    vec3 c = sampleAt(p);
    if (uFrost <= 0.0) return c;
    vec2 pixel = gl_FragCoord.xy - uOrigin;
    float turn = fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715)))) * 6.2831853;
    for (int i = 0; i < 24; i++) {
      float r = sqrt((float(i) + 0.5) / 24.0) * uFrost;
      float a = float(i) * 2.39996323 + turn;
      c += sampleAt(p + vec2(cos(a), sin(a)) * r);
    }
    return c / 25.0;
  }

  void main() {
    vec3 e = edge(vPos, uSize * 0.5, uRadius, uExp);
    float mag = 0.0;
    if (e.x >= 0.0 && e.x < uBezel) mag = pow(1.0 - e.x / uBezel, uCurve);

    // red bends further and blue less, per unit of dispersion
    vec2 bend = e.yz * uShift * mag;
    vec3 color = frosted(vPos - bend);
    if (uDispersion > 0.0) {
      color.r = frosted(vPos - bend * (1.0 + uDispersion)).r;
      color.b = frosted(vPos - bend * (1.0 - uDispersion)).b;
    }

    fragColor = vec4(toSRGB(color), 1.0);
  }
`

export type GlassUniforms = {
  /** The size the element is drawn at, transforms included, in px */
  size: [number, number]
  /** Where the center of the page is, from the center of the glass, y up */
  bg: [number, number]
  radius: number
  exponent: number
  bezel: number
  shift: number
  curve: number
  dispersion: number
  frost: number
}

/**
 * The uniforms of the profile for a glass drawn at w x h whose box is layoutWidth x layoutHeight.
 *
 * @param bg Where the center of the page is, from the center of the glass, y up
 */
export function profileUniforms(
  w: number,
  h: number,
  layoutWidth: number,
  layoutHeight: number,
  bg: [number, number],
  borderRadius: number,
  cornerExponent: number,
  shape: ShapeConfig,
  frost: number
): GlassUniforms {
  // the element can be drawn bigger or smaller than its box (a press, a stretch), and its corners with it
  const drawn = (w / layoutWidth + h / layoutHeight) / 2
  const half = Math.min(w, h) / 2
  // the profile was measured on small controls, where 25px of shift is a lot: a bigger surface bends over a wider
  // band and further, as real glass does, so both grow with the shortest side past the size they were fitted at
  const grow = Math.max(1, (half * 2) / FITTED_SIZE) ** shape.scaling
  return {
    size: [w, h],
    bg,
    radius: Math.max(0, Math.min(borderRadius * drawn, w / 2, h / 2)),
    exponent: cornerExponent,
    // a surface smaller than two bezels is all bend: the bezel shrinks to fit, and the shift stops at the middle
    bezel: Math.max(1, Math.min(shape.bezel * grow, half)),
    shift: Math.max(0, Math.min(shape.shift * grow, half)),
    curve: shape.curve,
    dispersion: shape.dispersion,
    frost,
  }
}
