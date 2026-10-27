import type { Material, WebGLProgramParametersWithUniforms } from "three"

/** What the shader of drei's MeshTransmissionMaterial is searched for, and has to still contain */
const ANCHOR = "float randomCoords = rand(runningSeed++);"
const TERM = "chromaticAberration * (i + randomCoords)"

/**
 * Concentrates the chromatic aberration of a MeshTransmissionMaterial at the rim of the glass.
 *
 * The material splits the colors by the same amount over the whole face. Real glass does it where the surface
 * is curved, so its strength is scaled by how much the surface is tilted away from the viewer: nothing on the
 * flat face, everything on the steep part of the bevel.
 *
 * It wraps the material's own `onBeforeCompile` and changes its shader, so it depends on how the material
 * writes it. If a later version of drei writes it differently the shader is left as it was, and the uniform has
 * no effect.
 *
 * @param material The material, which is only changed once
 * @param amount A uniform, 0 keeps the aberration even over the face and 1 puts all of it at the rim
 * @returns false if the shader wasn't recognized
 */
export function patchRimDispersion(material: Material, amount: { value: number }): boolean {
  if (material.userData.rimDispersion) return material.userData.rimDispersion === "patched"
  material.userData.rimDispersion = "patched"

  const original = material.onBeforeCompile
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    original.call(material, shader, renderer)
    if (!shader.fragmentShader.includes(ANCHOR) || !shader.fragmentShader.includes(TERM)) {
      material.userData.rimDispersion = "unrecognized"
      return
    }
    shader.uniforms.chromaticRim = amount
    shader.fragmentShader = `uniform float chromaticRim;\n${shader.fragmentShader}`
      .replace(
        ANCHOR,
        `${ANCHOR}
        float rimWeight = mix(1.0, smoothstep(0.0, 0.6, 1.0 - clamp(dot(n, v), 0.0, 1.0)), chromaticRim);`
      )
      .replaceAll(TERM, "chromaticAberration * rimWeight * (i + randomCoords)")
  }
  // in case it was compiled already
  material.needsUpdate = true
  return true
}
