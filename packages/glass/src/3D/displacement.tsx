import { invalidate } from "@react-three/fiber"
import { type MotionValue, useMotionValueEvent } from "motion/react"
import { useLayoutEffect, useMemo, useRef } from "react"
import type { RectReadOnly } from "react-use-measure"
import { type Mesh, ShaderMaterial, type Texture, Vector2 } from "three"
import type { ShapeConfig } from "../types/schemas"

export type GlassDisplacementProps = {
  /** The bounds of the element, updated outside of react */
  bounds: MotionValue<RectReadOnly>
  borderRadius: number
  /** Superellipse exponent of the corners, 2 is round and 4 a squircle */
  cornerExponent: number
  shape: ShapeConfig
  /** How much the backdrop is blurred, in px */
  frost: number
  /** The captured page, which is what gets bent */
  texture: Texture
}

/** The shortest side, in px, of the controls the apple profile was fitted on */
const FITTED_SIZE = 64

const VERTEX = /* glsl */ `
  uniform vec2 uSize;
  varying vec2 vPos;
  void main() {
    // the plane is 1 x 1 and scaled to the element, so this is the position in px from its center
    vPos = position.xy * uSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// How far in from the rim, and which way is out, for the point p (px from the center) of a box with corners of
// radius r and superellipse exponent n. Then the offset the profile gives it: nothing past the bezel, and inside
// it the sample is taken from further in (it never reads past the edge, where the backdrop ends), by an amount
// that grows toward the rim as t ** curve (t is 0 where the bezel meets the face and 1 at the rim).
const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uTexSize;
  uniform vec2 uBg;
  uniform vec2 uSize;
  uniform float uRadius;
  uniform float uExp;
  uniform float uBezel;
  uniform float uShift;
  uniform float uCurve;
  uniform float uDispersion;
  uniform float uFrost;
  varying vec2 vPos;

  // x: how far in from the nearest edge (negative outside), yz: that edge's outward normal
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

  vec3 sampleAt(vec2 p) {
    vec2 uv = (p - uBg) / uTexSize + 0.5;
    return texture2D(uMap, uv).rgb;
  }

  // the backdrop averaged over a disc of radius uFrost px: taps on a spiral that covers it evenly, turned a little
  // differently at every pixel so that what is left of the taps is grain and not a ghost of the image
  vec3 frosted(vec2 p) {
    vec3 c = sampleAt(p);
    if (uFrost <= 0.0) return c;
    float turn = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2831853;
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

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`

/**
 * # GlassDisplacement
 * The glass of the `apple` profile: instead of a bevel refracted by the transmission shader, the page behind is
 * sampled through a displacement profile. Near the rim of the glass the backdrop is pulled in from further inside,
 * by an amount that grows toward the rim, and the middle is left flat. The profile was extracted from recordings of
 * Apple's Liquid Glass (see Vitrium), where the rim also folds over: its outer band shows what is deeper in, as the
 * curved edge of real glass does.
 *
 * It is drawn flat, so it has none of the shading of the mesh (lights, sheen, clearcoat, roughness), which the edge
 * of the glass (rim, stroke, shadow) stands in for.
 */
export function GlassDisplacement(props: GlassDisplacementProps) {
  const { bounds, borderRadius, cornerExponent, shape, frost, texture } = props
  const mesh = useRef<Mesh>(null)

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uMap: { value: null },
          uTexSize: { value: new Vector2(1, 1) },
          uBg: { value: new Vector2() },
          uSize: { value: new Vector2(1, 1) },
          uRadius: { value: 0 },
          uExp: { value: 2 },
          uBezel: { value: 16 },
          uShift: { value: 25 },
          uCurve: { value: 2.5 },
          uDispersion: { value: 0 },
          uFrost: { value: 0 },
        },
      }),
    []
  )

  const sync = () => {
    const { width: w, height: h } = bounds.get()
    if (w <= 0 || h <= 0) return
    const half = Math.min(w, h) / 2
    const u = material.uniforms
    u.uMap.value = texture
    const image = texture.image as { width: number; height: number }
    u.uTexSize.value.set(image.width, image.height)
    u.uSize.value.set(w, h)
    u.uRadius.value = Math.max(0, Math.min(borderRadius, w / 2, h / 2))
    u.uExp.value = cornerExponent
    // the profile was measured on small controls, where 25px of shift is a lot: a bigger surface bends over a wider
    // band and further, as real glass does, so both grow with the shortest side past the size they were fitted at
    const grow = Math.max(1, (half * 2) / FITTED_SIZE) ** shape.scaling
    // a surface smaller than two bezels is all bend: the bezel shrinks to fit, and the shift stops at the middle
    u.uBezel.value = Math.max(1, Math.min(shape.bezel * grow, half))
    u.uShift.value = Math.max(0, Math.min(shape.shift * grow, half))
    u.uCurve.value = shape.curve
    u.uDispersion.value = shape.dispersion
    u.uFrost.value = frost
    mesh.current?.scale.set(w, h, 1)
    invalidate()
  }

  useLayoutEffect(sync, [bounds, borderRadius, cornerExponent, shape, frost, texture, material])
  useMotionValueEvent(bounds, "change", sync)
  useLayoutEffect(() => () => material.dispose(), [material])

  return (
    <mesh
      ref={mesh}
      material={material}
      frustumCulled={false}
      onBeforeRender={(_renderer, scene) => {
        // where the background plane is, which moves with the scroll
        const bg = scene.getObjectByName("glass-bg")
        if (bg) material.uniforms.uBg.value.set(bg.position.x, bg.position.y)
      }}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}
