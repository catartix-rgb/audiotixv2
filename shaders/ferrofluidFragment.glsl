// ferrofluidFragment.glsl  v0.5
// Now with TEARING — pixels in highly-stretched neck regions get discarded,
// creating holes/divisions in the fluid. The cutout threshold ALSO reacts
// to voice and transients so the fluid breaks open on vocal attacks.

uniform vec3 uColorBase;
uniform vec3 uColorAccent;
uniform vec3 uColorHighlight;
uniform float uBeat;
uniform float uTransient;
uniform float uVoice;
uniform float uEnergy;
uniform float uTime;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vSpike;
varying float vFlow;
varying float vDeplete;
varying float vStretch;
varying float vColumn;

// pseudo-random per-pixel for stochastic tearing
float hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

void main() {
  // ---- TEARING / FLUID DIVISION -------------------------------------
  // When the stretch indicator is high, randomly discard pixels — creates
  // the look of fluid tearing apart at the necks of stretched columns.
  // Voice & transients lower the threshold so vocals literally RIP the fluid.
  float tearThreshold = 0.72 - uVoice * 0.2 - uTransient * 0.35 - uBeat * 0.1;
  // stochastic dithering — gives torn EDGES instead of clean cuts
  float rnd = hash(floor(vWorldPos * 80.0));
  if (vStretch > tearThreshold && rnd < (vStretch - tearThreshold) * 2.5) {
    discard;
  }

  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnel = 1.0 - max(dot(viewDir, normalize(vNormal)), 0.0);

  vec3 col = vec3(0.008);
  float rim = pow(fresnel, 2.6);
  vec3 rimColor = mix(uColorBase, uColorAccent, clamp(vFlow * 0.6, 0.0, 1.0));
  rimColor += sin(uTime * 0.4 + vFlow * 3.0) * 0.05 * uColorHighlight;
  col += rimColor * rim * 0.95;

  float tip = smoothstep(0.22, 0.7, vSpike);
  col += uColorHighlight * tip * 1.1;
  float hotCore = smoothstep(0.55, 1.0, vSpike);
  col += vec3(1.0) * hotCore * 0.4;

  // Stretching neck: glows brighter just before tearing (looks like
  // the fluid is heating up before it breaks)
  float stretchGlow = smoothstep(0.4, 0.72, vStretch);
  col += uColorHighlight * stretchGlow * 0.5;

  col *= 1.0 - vDeplete * 4.0;
  col += uColorHighlight * uBeat * 0.18;
  col += uColorHighlight * uTransient * 0.25;   // transient flash
  col *= 0.85 + uEnergy * 0.55;

  gl_FragColor = vec4(col, 1.0);
}
