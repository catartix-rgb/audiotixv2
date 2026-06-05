// dropletVertex.glsl  v0.5
// Detached fluid droplets — eject from sphere surface on bass/transient,
// arc through space with gravity, fade out and respawn at new surface points.
//
// Each droplet is one POINT primitive with:
//   aHome (vec3) — direction from sphere center to its "spawn surface point"
//   aSeed (float) — 0..1 random per droplet for phase variation
//   aSpeed (float) — base ejection velocity multiplier
//
// We compute a continuous cyclic phase that loops the droplet through
// spawn → fly → fall → fade → respawn at a NEW surface point each cycle.

uniform float uTime;
uniform float uBass;
uniform float uBassEnv;
uniform float uMid;
uniform float uVoice;
uniform float uHigh;
uniform float uTransient;
uniform float uPunch;
uniform float uBeat;
uniform float uIntensity;
uniform float uPixelRatio;

attribute vec3 aHome;
attribute float aSeed;
attribute float aSpeed;

varying float vLife;       // 0..1 progress through cycle
varying float vSeed;
varying float vEjection;   // how hard this droplet was launched

vec3 hash33(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

void main() {
  // Each droplet has its own period (1.2..2.6 seconds depending on aSeed/aSpeed).
  // We use floor(cycle) to identify WHICH iteration we're on so we can pick
  // a new spawn point each iteration.
  float period = 1.2 + aSeed * 1.4 + aSpeed * 0.3;
  float cycle = uTime / period + aSeed * 100.0;
  float iter = floor(cycle);
  float phase = fract(cycle);   // 0..1 within this iteration

  // Pick a new pseudo-random home direction each iteration so the droplets
  // appear to come from all over the surface, not the same spots.
  vec3 randomDir = normalize(aHome + hash33(aHome + iter) * 0.9);
  // Slightly above the surface where it spawns
  vec3 spawnPos = randomDir * 1.0;

  // Ejection strength scales with sustained bass + spikes when transient hits.
  // bassEnv keeps droplets flowing during the song; PUNCH causes big BURSTS.
  float launch = uBassEnv * 0.9 + uBass * 0.3 + uTransient * 1.8
               + uBeat * 1.0 + uVoice * 0.4 + uPunch * 3.0;
  launch *= uIntensity;
  vEjection = launch;

  // Trajectory: position = spawn + normal*phase*launch - gravity*phase²
  // Phase goes 0→1 over the period. Distance from sphere center grows with phase.
  float reach = phase * (0.6 + launch * 1.4) * aSpeed;
  vec3 pos = spawnPos + randomDir * reach;

  // Gravity — accelerating downward
  pos.y -= phase * phase * (0.8 + launch * 0.6);

  // Lateral drift — droplets curl outward as they fly (mid + voice driven)
  pos.x += sin(uTime * 2.0 + aSeed * 30.0) * phase * (uMid + uVoice) * 0.2;
  pos.z += cos(uTime * 2.0 + aSeed * 27.0) * phase * (uMid + uVoice) * 0.2;

  vLife = phase;
  vSeed = aSeed;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Size: starts BIG (fresh droplet), shrinks as it travels (evaporates).
  // Boost size during launch events.
  float baseSize = 12.0 * (1.0 - phase * 0.85);
  baseSize *= (0.6 + launch * 1.2);
  // Some droplets are bigger than others
  baseSize *= 0.5 + aSeed * 1.5;
  gl_PointSize = baseSize * uPixelRatio * (50.0 / -mvPosition.z);
}
