// particlesVertex.glsl  v0.5
// Stronger reactivity, voice + transient inputs.

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uVoice;
uniform float uTransient;
uniform float uPunch;
uniform float uBeat;
uniform float uIntensity;
uniform float uPixelRatio;

attribute float aSeed;
attribute float aRadius;
attribute float aSpeed;

varying float vSeed;
varying float vEnergy;

void main() {
  vSeed = aSeed;

  float personalT = uTime * (0.15 + aSpeed * 0.35);
  float angle = aSeed * 6.2831 + personalT
              + sin(uTime * 0.3 + aSeed * 12.0) * 0.4
              + cos(uTime * 0.13 + aSeed * 7.0) * 0.2;

  // Radius reacts to bass MUCH more + voice puts pressure on it too
  float radiusDrift = 1.0 + 0.15 * sin(uTime * 0.2 + aSeed * 30.0);
  float r = aRadius * radiusDrift * (1.0 + uBass * 1.2 * uIntensity + uVoice * 0.4 * uIntensity);

  // Y position: two non-aligned sines + voice-driven undulation
  float y = sin(personalT * 1.1 + aSeed * 12.0) * 0.4
          + sin(personalT * 1.7 + aSeed * 27.0) * 0.2;
  y += sin(uTime * 0.4 + aSeed * 5.0) * (uMid * 1.4 + uVoice * 1.8) * uIntensity;

  vec3 pos = vec3(cos(angle) * r, y, sin(angle) * r);

  // High-frequency jitter — boosted, plus transient SHOCK
  pos.x += sin(uTime * 8.0 + aSeed * 30.0) * uHigh * 0.3 * uIntensity;
  pos.z += cos(uTime * 9.0 + aSeed * 27.0) * uHigh * 0.3 * uIntensity;
  pos.y += sin(uTime * 11.0 + aSeed * 41.0) * uHigh * 0.2 * uIntensity;

  // Transient = sudden outward kick (voice attack)
  vec3 dirFromCenter = normalize(pos);
  pos += dirFromCenter * uTransient * 0.4 * uIntensity;

  // PUNCH = explosive radial burst. Each kick blows the whole cloud outward
  // hard, then it falls back as punch decays. Impossible to miss.
  pos *= 1.0 + uBeat * 0.2 + uPunch * 0.95 * uIntensity;
  pos += dirFromCenter * uPunch * 0.85 * uIntensity;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Particle size: high + transient + PUNCH = big bright flashes on hits
  float size = (1.5 + uHigh * 8.0 + uBeat * 6.0 + uTransient * 10.0 + uPunch * 26.0) * uPixelRatio;
  gl_PointSize = size * (50.0 / -mvPosition.z);

  vEnergy = uBass + uMid + uHigh + uVoice;
}
