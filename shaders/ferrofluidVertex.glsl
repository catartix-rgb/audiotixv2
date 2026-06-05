// ferrofluidVertex.glsl  v0.5
// Real fluid behavior: Voronoi columns + tearing + droplet detachment + voice reactivity.
//
// New in v0.5:
//  - Stronger overall response (bass/beat/voice multipliers ~doubled)
//  - Voice (uVoice) and transient (uTransient) add separate motion channels:
//      voice  → adds lateral wobble + spike rise (vocals lift the fluid)
//      transient → instant "splash" on consonants / claps
//  - Outputs vStretch (how much the spike is stretching) → fragment uses
//    this to DISCARD pixels and create torn holes / fluid division.
//  - sustained bassEnv used so the fluid stays "magnetized" between kicks
//    instead of instantly relaxing.

uniform float uTime;
uniform float uBass;
uniform float uBassEnv;
uniform float uMid;
uniform float uHigh;
uniform float uVoice;
uniform float uTransient;
uniform float uPunch;
uniform float uBeat;
uniform float uEnergy;
uniform float uIntensity;
uniform float uSeed;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vSpike;
varying float vFlow;
varying float vDeplete;
varying float vStretch;     // 0..1 — 1 means this point is being stretched thin (will tear)
varying float vColumn;

// ---- snoise -----------------------------------------------------------
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0)) +
    i.y + vec4(0.0, i1.y, i2.y, 1.0)) +
    i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

vec3 hash33(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

struct VoronoiResult { float dist; vec3 toSeed; };

VoronoiResult voronoi3D(vec3 p, float t) {
  vec3 b = floor(p);
  vec3 f = fract(p);
  float minDist = 99.0;
  vec3 minTo = vec3(0.0);
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 offset = 0.5 + 0.5 * sin(t + 6.2831 * hash33(b + g));
        vec3 r = g + offset - f;
        float d = dot(r, r);
        if (d < minDist) { minDist = d; minTo = r; }
      }
    }
  }
  VoronoiResult res;
  res.dist = sqrt(minDist);
  res.toSeed = minTo;
  return res;
}

vec3 curlNoise(vec3 p) {
  const float e = 0.1;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);
  float p_y0 = snoise(p - dy); float p_y1 = snoise(p + dy);
  float p_z0 = snoise(p - dz); float p_z1 = snoise(p + dz);
  vec3 q = p + vec3(31.4, 47.8, 12.7);
  float q_x0 = snoise(q - dx); float q_x1 = snoise(q + dx);
  float q_z0 = snoise(q - dz); float q_z1 = snoise(q + dz);
  vec3 r = p + vec3(73.1, 28.0, 51.4);
  float r_x0 = snoise(r - dx); float r_x1 = snoise(r + dx);
  float r_y0 = snoise(r - dy); float r_y1 = snoise(r + dy);
  float x = (r_y1 - r_y0) - (q_z1 - q_z0);
  float y = (p_z1 - p_z0) - (r_x1 - r_x0);
  float z = (q_x1 - q_x0) - (p_y1 - p_y0);
  return vec3(x, y, z) / (2.0 * e);
}

void main() {
  vec3 pos = position;
  vec3 n = normalize(pos);
  float t = uTime;

  float speedMod = 0.6 + 0.4 * snoise(vec3(t * 0.04, uSeed, 0.0));

  // Flow advection
  vec3 flow = curlNoise(n * 1.2 + vec3(t * 0.1 * speedMod, uSeed, 0.0)) * 0.5;
  vFlow = length(flow);

  // Voronoi spike field. Add voice-driven jitter so seeds shiver with vocals.
  float spikeDensity = 5.5;
  vec3 voiceJitter = vec3(
    sin(t * 3.0 + uSeed * 13.0),
    cos(t * 2.7 + uSeed * 7.0),
    sin(t * 3.3 + uSeed * 19.0)
  ) * uVoice * 0.18;
  vec3 vorCoord = n * spikeDensity + flow * 0.6 + voiceJitter;
  float vorTime = t * 0.25 * speedMod + uSeed;
  VoronoiResult vor = voronoi3D(vorCoord, vorTime);

  float column = 1.0 - smoothstep(0.0, 0.55, vor.dist);
  column = pow(column, 2.0);
  vColumn = column;

  // ---- Magnetization — DOUBLED reactivity ---------------------------
  // Use sustained bassEnv for the "field" so the fluid stays excited
  // between kicks. Add voice (mid-range pull) + transient pop + beat.
  float field = uBassEnv * 1.5 + uBass * 0.7 + uVoice * 1.0
              + uBeat * 1.2 + uTransient * 1.4 + uPunch * 4.5 + uEnergy * 0.3;
  float threshold = 0.15;
  float magnetize = smoothstep(threshold, threshold + 0.45, field) * (0.7 + field);
  magnetize *= uIntensity;

  float spike = column * magnetize * 1.0;

  // Sharp tip pinch — bigger boost now
  float tipPinch = smoothstep(0.45, 0.85, column);
  spike += tipPinch * magnetize * 0.6;

  // EXTRA tip elongation on transients — vocals/claps make the columns
  // shoot UP suddenly like a fluid splash
  spike += tipPinch * uTransient * 0.9 * uIntensity;

  // ---- Stretch indicator (for tearing in fragment) ------------------
  // Areas where the spike has been pulled out far AND the column profile
  // is in its "neck" region (mid-radius, ~0.45 distance) — that's where
  // real ferrofluid columns thin out and break.
  float neckBand = smoothstep(0.42, 0.55, vor.dist) * (1.0 - smoothstep(0.55, 0.7, vor.dist));
  vStretch = clamp(neckBand * magnetize * 1.4 + tipPinch * uTransient * 0.6, 0.0, 1.0);

  // ---- Depletion around active columns -----------------------------
  float depleteBand = smoothstep(0.45, 0.65, vor.dist) * (1.0 - smoothstep(0.65, 0.95, vor.dist));
  float deplete = depleteBand * magnetize * 0.25;
  vDeplete = deplete;

  // ---- Mid + voice ripples ------------------------------------------
  vec3 advected = n * 4.0 + flow + vec3(t * 0.2, 0.0, -t * 0.15);
  float ripple = snoise(advected * 1.8) * 0.06 * (0.3 + uMid + uVoice * 0.7) * uIntensity;
  float fineRipple = snoise(advected * 6.0 + uTime) * 0.025 * (uMid + uVoice * 0.5) * uIntensity;

  // ---- Body breathing -----------------------------------------------
  float body = snoise(n * 1.0 + vec3(t * 0.06, uSeed, 0.0)) * 0.08
             * (0.5 + uBass * 0.8 + uVoice * 0.3);

  // ---- Gravity / droop ----------------------------------------------
  vec3 gravity = vec3(0.0, -1.0, 0.0);
  float droop = tipPinch * 0.08 * (0.5 + magnetize);

  // Combine
  float radialDisp = spike + ripple + fineRipple + body - deplete;
  pos += n * radialDisp;
  pos += gravity * droop * uIntensity;

  // Lateral tip wobble — amplified by voice
  float wobAmt = tipPinch * (0.012 + uVoice * 0.04 + uTransient * 0.05) * uIntensity;
  pos += vec3(
    sin(t * 4.0 + uSeed * 13.0 + n.x * 10.0) * wobAmt,
    sin(t * 6.0 + uSeed * 5.0 + n.y * 7.0) * wobAmt * 0.5,
    cos(t * 4.0 + uSeed * 17.0 + n.z * 10.0) * wobAmt
  );

  vSpike = spike;

  // PUNCH shockwave — the whole fluid body lurches outward on each hit
  pos *= 1.0 + uPunch * 0.42 * uIntensity;

  vec3 transformedNormal = normalize(mat3(modelMatrix) * normal);
  vNormal = transformedNormal;
  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPos.xyz;
  vec4 mvPos = viewMatrix * worldPos;

  gl_Position = projectionMatrix * mvPos;
}
