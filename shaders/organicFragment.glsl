// organicFragment.glsl  v0.4
// Uses world-space position so the fresnel actually tracks the camera.

uniform vec3 uColorBase;
uniform vec3 uColorAccent;
uniform vec3 uColorHighlight;
uniform float uBeat;
uniform float uEnergy;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vDisplacement;

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - max(dot(viewDir, normalize(vNormal)), 0.0), 2.5);

  vec3 col = mix(uColorAccent, uColorBase, fresnel);
  col += uColorBase * smoothstep(0.0, 0.6, vDisplacement) * 0.45;
  col += uColorHighlight * uBeat * 0.35;
  col *= 0.7 + uEnergy * 0.9;

  gl_FragColor = vec4(col, 1.0);
}
