// dropletFragment.glsl  v0.5
// Soft round droplets with a bright core. They look like detached fluid
// blobs catching the light. Match the ferrofluid palette.

uniform vec3 uColorBase;
uniform vec3 uColorHighlight;

varying float vLife;
varying float vSeed;
varying float vEjection;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  // hard-ish disc with soft edge — these are LIQUID drops, not gaseous puffs
  float a = smoothstep(0.5, 0.3, d);
  if (a < 0.02) discard;

  // Hot core in the center (fluid is still "wet" / reflective)
  float core = smoothstep(0.3, 0.0, d);

  vec3 col = mix(uColorBase, uColorHighlight, vSeed * 0.5 + vEjection * 0.4);
  col += vec3(1.0) * pow(core, 3.0) * (0.4 + vEjection * 0.4);

  // Fade out over life — droplet "evaporates" as it falls
  float lifeAlpha = (1.0 - vLife) * (1.0 - vLife);

  gl_FragColor = vec4(col, a * lifeAlpha);
}
