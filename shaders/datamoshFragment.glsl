// datamoshFragment.glsl  v0.5
// Boosted reactivity. Voice and transients now drive specific glitches:
//   voice    → wave-driven horizontal stretch (vocals "smear" the image)
//   transient → sudden RGB explosion + block displacement spike

uniform sampler2D uTexture;
uniform sampler2D uWaveform;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uVoice;
uniform float uTransient;
uniform float uBeat;
uniform float uIntensity;
uniform vec2 uResolution;
uniform float uHasTexture;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float hash11(float p) { return fract(sin(p * 12.9898) * 43758.5453); }

void main() {
  vec2 uv = vUv;

  // Waveform-driven horizontal smear — boosted by voice
  float waveAt = texture2D(uWaveform, vec2(uv.y, 0.5)).r;
  float waveOffset = (waveAt - 0.5) * (0.18 + uVoice * 0.25) * uIntensity;
  uv.x += waveOffset;

  // ---- Block displacement on beats AND transients --------------------
  float blockSize = 0.04;
  vec2 block = floor(uv / blockSize);
  float blockHash = hash(block + floor(uTime * 8.0));
  float beatShift = step(0.85, blockHash) * (uBeat + uTransient * 1.5) * 0.12 * uIntensity;
  uv.x += (hash(block) - 0.5) * beatShift * 2.0;
  uv.y += (hash(block + 0.5) - 0.5) * beatShift * 0.8;   // also vertical now

  // Horizontal pixel-sort bands — more aggressive
  float band = floor(uv.y * 30.0);
  float bandSeed = hash11(band + floor(uTime * 2.0));
  float sortBand = step(0.92 - uHigh * 0.15 - uTransient * 0.15, bandSeed) * uIntensity;
  uv.x = mix(uv.x, floor(uv.x * 60.0) / 60.0 + 0.5/60.0, sortBand);

  // ---- RGB channel separation — BOOSTED ------------------------------
  float chroma = 0.005 + uMid * 0.04 * uIntensity + uVoice * 0.05 * uIntensity
               + uBeat * 0.03 + uTransient * 0.06;
  vec2 dir = vec2(1.0, 0.4);
  vec4 r = texture2D(uTexture, uv + dir * chroma);
  vec4 g = texture2D(uTexture, uv);
  vec4 b = texture2D(uTexture, uv - dir * chroma);
  vec3 col = vec3(r.r, g.g, b.b);

  // Scanlines
  float scan = 0.92 + 0.08 * sin(vUv.y * uResolution.y * 1.6);
  col *= scan;

  // Saturation pump on beat + transient
  float gray = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(gray), col, 1.0 + uBeat * 0.7 + uTransient * 0.9);

  // Vignette
  float vig = smoothstep(1.2, 0.3, length(vUv - 0.5));
  col *= vig;

  // Placeholder when no texture loaded
  if (uHasTexture < 0.5) {
    float grid = step(0.98, sin(vUv.x * 80.0) * sin(vUv.y * 80.0));
    col = vec3(0.05) + vec3(0.0, 0.3, 0.18) * grid * (0.5 + uBass + uVoice);
  }

  gl_FragColor = vec4(col, 1.0);
}
