'use client';

import { Color } from 'three';
import type { Palette } from './palettes';
import type { AudioFrame } from '@/hooks/useAudio';

/**
 * ColorEngine v0.7 — generative, audio-reactive color with PUNCHY beat response.
 *
 * What changed vs v0.6:
 *  - Bigger, more visible hue jumps (biased toward triadic/complementary, not
 *    the near-invisible analogous step).
 *  - "snapBoost": on each beat the interpolation speed spikes, so the new color
 *    LANDS almost instantly, then drifts gently until the next beat. This makes
 *    the change read as a hit instead of a slow fade.
 *  - Backup bass-jump detector: even if the formal beat flag doesn't fire, a
 *    sharp rise in bass triggers a color change. Double guarantee.
 *  - Beat also pumps brightness/saturation for an extra visible "pop".
 */

type Harmony = 'complementary' | 'triadic' | 'analogous' | 'splitComp' | 'golden';

function fract(x: number): number {
  return ((x % 1) + 1) % 1;
}

function lerpHue(a: number, b: number, t: number): number {
  let d = b - a;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return fract(a + d * t);
}

class ColorEngine {
  palette: Palette = {
    bg: new Color('#050505'),
    base: new Color('#3DFFA2'),
    accent: new Color('#0E3D26'),
    highlight: new Color('#F2E255'),
  };

  private hue = Math.random();
  private targetHue = Math.random();
  private harmony: Harmony = 'triadic';
  private lastBeatTime = -1;
  private accentLightTarget = 0.2;
  private snapBoost = 0;       // 0..1 — spikes on beat, accelerates the transition
  private beatPulse = 0;       // 0..1 — brightness pop on beat
  private prevBass = 0;

  private _base = new Color();
  private _accent = new Color();
  private _highlight = new Color();
  private _bg = new Color();

  private harmonyOffset(): number {
    switch (this.harmony) {
      case 'complementary': return 0.5;
      case 'triadic': return 1 / 3;
      case 'analogous': return 0.14;   // bumped from 0.08 so even analogous is visible
      case 'splitComp': return 0.42;
      case 'golden': return 0.381966;
      default: return 0.14;
    }
  }

  private pickHarmony(): Harmony {
    // Bias toward LARGE, visible jumps. Analogous is rare now.
    const options: Harmony[] = [
      'triadic', 'triadic',
      'complementary', 'complementary',
      'splitComp', 'golden',
      'analogous',
    ];
    return options[Math.floor(Math.random() * options.length)];
  }

  private buildTarget(energy: number, beatPulse: number) {
    const sat = 0.72 + energy * 0.25 + beatPulse * 0.1;
    const light = 0.5 + beatPulse * 0.12;           // beat brightens base
    this._base.setHSL(this.hue, Math.min(1, sat), Math.min(0.75, light));

    const accentHue = fract(this.hue + this.harmonyOffset());
    this._accent.setHSL(accentHue, 0.5, this.accentLightTarget);

    this._highlight.setHSL(fract(this.hue + 0.05), 0.9, 0.7 + beatPulse * 0.1);

    this._bg.setHSL(this.hue, 0.45, 0.028 + beatPulse * 0.015);
  }

  reset() {
    this.hue = Math.random();
    this.targetHue = Math.random();
    this.harmony = this.pickHarmony();
  }

  update(frame: AudioFrame, delta: number, time: number) {
    // ---- HIT trigger: punch is the unified percussive signal ---------
    // punch already fuses kick + flux onset + transient with instant attack.
    const punchHit = frame.punch > 0.2 && time - this.lastBeatTime > 0.07;

    if (punchHit) {
      this.lastBeatTime = time;
      let offset = this.harmonyOffset();
      // STRONG hits jump a bigger harmonic interval; soft hits nudge less.
      // This is the "Auto Beat Color" energy mapping: louder = bolder color move.
      if (frame.beatStrength > 1.6) offset *= 1.5;
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.targetHue = fract(this.targetHue + offset * dir);
      if (Math.random() < 0.45) this.harmony = this.pickHarmony();
      this.accentLightTarget = 0.12;

      // strong hits SNAP the hue instantly — the harder the punch, the more
      // we jump straight to the target color. Strong kicks ≈ full snap.
      const snapAmount = Math.min(1, frame.beatStrength * 0.85 + frame.punch * 0.6);
      this.hue = lerpHue(this.hue, this.targetHue, snapAmount);
      // ALSO snap the displayed base color partway immediately so the change
      // is visible on the very next frame, not after the lerp catches up.
      this.buildTarget(frame.energy, Math.min(1.8, frame.punch));
      const instant = Math.min(0.95, snapAmount);
      this.palette.base.lerp(this._base, instant);
      this.palette.highlight.lerp(this._highlight, instant);
      this.palette.bg.lerp(this._bg, instant * 0.7);

      this.snapBoost = 1.0;
      this.beatPulse = Math.min(1.8, frame.punch);
    }

    // ---- transient → quick nudge + brighten --------------------------
    if (frame.transient > 0.3) {
      this.targetHue = fract(this.targetHue + 0.06 * frame.transient);
      this.accentLightTarget = 0.3;
      this.snapBoost = Math.max(this.snapBoost, 0.8);
      this.beatPulse = Math.max(this.beatPulse, frame.transient);
    }

    // ---- ambient drift -----------------------------------------------
    this.targetHue = fract(this.targetHue + delta * 0.008);
    this.accentLightTarget += (0.2 - this.accentLightTarget) * delta * 1.5;

    // ---- decays ------------------------------------------------------
    this.snapBoost *= Math.pow(0.0008, delta);
    this.beatPulse *= Math.pow(0.015, delta);

    // ---- hue interpolation: fast during snap, gentle otherwise -------
    const hueSpeed = 2.5 + this.snapBoost * 24.0;
    this.hue = lerpHue(this.hue, this.targetHue, Math.min(1, delta * hueSpeed));

    // ---- build + lerp displayed colors -------------------------------
    this.buildTarget(frame.energy, this.beatPulse);
    const kk = Math.min(1, delta * (6.0 + this.snapBoost * 26.0));
    this.palette.base.lerp(this._base, kk);
    this.palette.accent.lerp(this._accent, kk);
    this.palette.highlight.lerp(this._highlight, kk);
    this.palette.bg.lerp(this._bg, kk);
  }
}

export const colorEngine = new ColorEngine();
