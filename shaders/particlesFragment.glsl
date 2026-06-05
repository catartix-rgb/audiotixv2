// particlesFragment.glsl
// Soft circular sprites colored by palette + energy.

uniform vec3 uColorBase;
uniform vec3 uColorHighlight;

varying float vSeed;
varying float vEnergy;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  // soft falloff
  float a = smoothstep(0.5, 0.0, d);
  if (a < 0.02) discard;

  vec3 col = mix(uColorBase, uColorHighlight, vSeed * 0.6 + vEnergy * 0.3);
  // bright core
  col += vec3(1.0) * pow(a, 6.0) * 0.4;

  gl_FragColor = vec4(col, a);
}
