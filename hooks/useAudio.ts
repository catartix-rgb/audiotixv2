'use client';

import { useEffect, useRef } from 'react';
import { useStore } from './useStore';

/**
 * AudioEngine v0.5
 * Now exposes:
 *  - bass / mid / high — broad bands
 *  - voice — focused 200Hz..2.5kHz band where vocal content lives
 *  - transient — short spike on sudden onsets (vocal attacks, claps,
 *    consonants, snare hits). Independent of beat detection (which is bass).
 *  - bassEnv — sustained bass envelope (decays slower than bass itself).
 *    Useful for "magnetic field" style sustained reactions.
 */
export interface AudioFrame {
  bass: number;
  mid: number;
  high: number;
  voice: number;
  transient: number;
  bassEnv: number;
  energy: number;
  beat: number;
  punch: number;        // unified percussive HIT (kick+snare+transient), ultra-fast decay
  beatStrength: number; // how hard the last hit was, relative to recent average (~0..2.5)
  flux: number;         // raw spectral flux (onset energy) this frame
  freq: Uint8Array;
  wave: Uint8Array;
  time: number;
}

const FFT_SIZE = 1024;

function createEmptyFrame(): AudioFrame {
  return {
    bass: 0, mid: 0, high: 0, voice: 0,
    transient: 0, bassEnv: 0, energy: 0, beat: 0,
    punch: 0, beatStrength: 0, flux: 0,
    freq: new Uint8Array(FFT_SIZE / 2),
    wave: new Uint8Array(FFT_SIZE),
    time: 0,
  };
}

class AudioEngine {
  ctx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  gain: GainNode | null = null;
  source: MediaElementAudioSourceNode | null = null;
  streamSource: MediaStreamAudioSourceNode | null = null;
  el: HTMLAudioElement | null = null;
  mode: 'file' | 'stream' | null = null;
  freq = new Uint8Array(FFT_SIZE / 2);
  wave = new Uint8Array(FFT_SIZE);
  frame: AudioFrame = createEmptyFrame();

  private bassHistory: number[] = [];
  private transientHistory: number[] = [];
  private fluxHistory: number[] = [];
  private prevFreq = new Float32Array(FFT_SIZE / 2);
  private lastBeat = 0;
  private lastPunch = 0;
  private lastUpdateTime = -1;
  private prevUpdateTime = -1;
  private prevHigh = 0;
  private prevVoice = 0;
  private userVolume = 1.0;

  private ensureAnalyser() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (!this.analyser) {
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = FFT_SIZE;
      this.analyser.smoothingTimeConstant = 0.78;
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.userVolume;
      // analyser → gain → destination (always wired; gain controls audibility)
      this.analyser.connect(this.gain);
      this.gain.connect(this.ctx.destination);
    }
  }

  // ---- FILE source (uploaded mp3/wav) --------------------------------
  attach(el: HTMLAudioElement) {
    this.ensureAnalyser();
    // createMediaElementSource can only be called ONCE per element
    if (this.el !== el) {
      this.el = el;
      this.source = this.ctx!.createMediaElementSource(el);
    }
    this.setMode('file');
  }

  // ---- SYSTEM source (screen / tab capture via getDisplayMedia) ------
  attachStream(stream: MediaStream) {
    this.ensureAnalyser();
    // tear down any previous stream source
    try { this.streamSource?.disconnect(); } catch {}
    this.streamSource = this.ctx!.createMediaStreamSource(stream);
    this.setMode('stream');
  }

  private setMode(mode: 'file' | 'stream') {
    // disconnect both sources from the analyser, then reconnect the active one
    try { this.source?.disconnect(); } catch {}
    try { this.streamSource?.disconnect(); } catch {}

    if (mode === 'file' && this.source) {
      this.source.connect(this.analyser!);
      // file audio should be audible — restore user volume
      this.setVolume(this.userVolume);
    } else if (mode === 'stream' && this.streamSource) {
      this.streamSource.connect(this.analyser!);
      // system audio is ALREADY audible from the source app — mute our output
      // to avoid echo/feedback. We still analyze the signal.
      if (this.gain && this.ctx) {
        this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
      }
    }
    this.mode = mode;
  }

  resume() { this.ctx?.resume(); }

  setVolume(v: number) {
    this.userVolume = Math.max(0, Math.min(2, v));
    // only apply if we're in file mode (stream stays muted)
    if (this.gain && this.ctx && this.mode !== 'stream') {
      const now = this.ctx.currentTime;
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setTargetAtTime(this.userVolume, now, 0.02);
    }
  }

  update(sensitivity = 1): AudioFrame {
    const a = this.analyser;
    if (!a) return this.frame;

    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (now === this.lastUpdateTime) return this.frame;
    this.lastUpdateTime = now;

    a.getByteFrequencyData(this.freq);
    a.getByteTimeDomainData(this.wave);

    // real elapsed time since last analyzed frame, for time-based decays
    const dt =
      this.prevUpdateTime < 0 ? 0.016 : Math.min(0.1, (now - this.prevUpdateTime) / 1000);
    this.prevUpdateTime = now;

    const len = this.freq.length;
    const bassEnd = Math.floor(len * 0.06);    // ~ 0..1.3kHz (kick region)
    const midEnd = Math.floor(len * 0.25);     // ~ 1.3..5.5kHz
    const voiceStart = Math.floor(len * 0.012);
    const voiceEnd = Math.floor(len * 0.13);

    let b = 0, m = 0, h = 0, v = 0;
    for (let i = 0; i < bassEnd; i++) b += this.freq[i];
    for (let i = bassEnd; i < midEnd; i++) m += this.freq[i];
    for (let i = midEnd; i < len; i++) h += this.freq[i];
    for (let i = voiceStart; i < voiceEnd; i++) v += this.freq[i];

    const bass = (b / (bassEnd * 255)) * sensitivity;
    const mid = (m / ((midEnd - bassEnd) * 255)) * sensitivity;
    const high = (h / ((len - midEnd) * 255)) * sensitivity;
    const voice = (v / ((voiceEnd - voiceStart) * 255)) * sensitivity;

    // Bands stay reasonably smooth (these drive shape size / texture)
    const k = 0.3;
    this.frame.bass += (bass - this.frame.bass) * k;
    this.frame.mid += (mid - this.frame.mid) * k;
    this.frame.high += (high - this.frame.high) * k;
    this.frame.voice += (voice - this.frame.voice) * k;
    this.frame.energy += ((bass + mid + high) / 3 - this.frame.energy) * k;

    if (bass > this.frame.bassEnv) {
      this.frame.bassEnv = bass;
    } else {
      this.frame.bassEnv += (bass - this.frame.bassEnv) * 0.04;
    }

    // ============================================================
    //  SPECTRAL FLUX ONSET DETECTION
    //  Sum of positive bin-to-bin increases across mid+high. This is
    //  the standard way to catch ATTACKS (kick clicks, snares, hats,
    //  stabs, transients) — far better than tracking raw volume,
    //  because it responds to NEW energy appearing, not loudness.
    // ============================================================
    let flux = 0;
    for (let i = bassEnd; i < len; i++) {
      const diff = this.freq[i] - this.prevFreq[i];
      if (diff > 0) flux += diff;
      this.prevFreq[i] = this.freq[i];
    }
    flux = (flux / ((len - bassEnd) * 255)) * sensitivity;
    this.frame.flux = flux;

    this.fluxHistory.push(flux);
    if (this.fluxHistory.length > 43) this.fluxHistory.shift();
    const fluxAvg =
      this.fluxHistory.reduce((s, x) => s + x, 0) / this.fluxHistory.length;

    // ---- Transient (snare / consonant / clap) --------------------------
    const transientSignal = high * 0.5 + voice * 0.7;
    const tDelta = Math.max(0, transientSignal - this.prevHigh - this.prevVoice * 0.7);
    this.transientHistory.push(transientSignal);
    if (this.transientHistory.length > 30) this.transientHistory.shift();
    const tAvg =
      this.transientHistory.reduce((s, x) => s + x, 0) / this.transientHistory.length;
    let transientHit = 0;
    if (tDelta > 0.03 && transientSignal > tAvg * 1.15) {
      transientHit = Math.min(1.5, tDelta * 7);
    }
    // time-based decay (~70ms half-life) — much snappier than before
    this.frame.transient = Math.max(
      transientHit,
      this.frame.transient * Math.pow(0.5, dt / 0.07),
    );
    this.prevHigh = high;
    this.prevVoice = voice;

    // ---- KICK detection (bass band) ------------------------------------
    this.bassHistory.push(bass);
    if (this.bassHistory.length > 43) this.bassHistory.shift();
    const bassAvg =
      this.bassHistory.reduce((s, x) => s + x, 0) / this.bassHistory.length;
    const ctxTime = this.ctx?.currentTime ?? now / 1000;

    // MUCH more sensitive: lower ratios + lower floors so every real hit fires.
    const kickHit =
      bass > bassAvg * 1.1 && bass > 0.13 && ctxTime - this.lastBeat > 0.1;
    const fluxHit =
      flux > fluxAvg * 1.22 && flux > 0.007 && ctxTime - this.lastPunch > 0.06;

    // ---- BEAT (kick) — drives the formal beat flag --------------------
    let newBeatStrength = 0;
    if (kickHit) {
      this.lastBeat = ctxTime;
      this.frame.beat = 1;
      newBeatStrength = bass / (bassAvg + 0.001); // how many× over average
    } else {
      // fast time-based decay (~70ms half-life) so each kick is a discrete hit
      this.frame.beat *= Math.pow(0.5, dt / 0.07);
    }

    // ============================================================
    //  PUNCH — the unified percussive HIT the visuals react to.
    //  Combines kick strength + flux onset + transient. Attack is
    //  INSTANT, decay is ULTRA fast (~50ms half-life) so it reads as
    //  a slam, not a swell. Prioritizes transients/onsets over volume.
    //  Magnitudes boosted so hits punch harder visually.
    // ============================================================
    let newPunch = 0;
    if (kickHit) {
      newPunch = Math.max(newPunch, Math.min(2.4, (bass / (bassAvg + 0.001)) * 1.1));
    }
    if (fluxHit) {
      this.lastPunch = ctxTime;
      newPunch = Math.max(newPunch, Math.min(2.4, (flux / (fluxAvg + 0.001)) * 1.0));
    }
    newPunch = Math.max(newPunch, transientHit * 1.3);

    if (newPunch > this.frame.punch) {
      this.frame.punch = newPunch;               // instant attack
      this.frame.beatStrength = Math.max(newBeatStrength, newPunch);
    } else {
      // ~90ms half-life — fast enough to read as a slam, slow enough to SEE
      // the shape expand and snap back. (Was 50ms = too brief to perceive.)
      this.frame.punch *= Math.pow(0.5, dt / 0.09);
    }

    this.frame.freq = this.freq;
    this.frame.wave = this.wave;
    this.frame.time = this.el?.currentTime ?? 0;
    return this.frame;
  }
}

export const audioEngine = new AudioEngine();

export function useAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const url = useStore((s) => s.audioUrl);
  const isPlaying = useStore((s) => s.isPlaying);
  const setPlaying = useStore((s) => s.setPlaying);
  const volume = useStore((s) => s.volume);
  const audioSource = useStore((s) => s.audioSource);

  useEffect(() => {
    if (audioRef.current) {
      audioEngine.attach(audioRef.current);
      audioEngine.setVolume(volume);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // load new file + switch engine back to file mode
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !url || audioSource !== 'file') return;
    audioEngine.attach(el); // re-route engine to file source (in case we were on system)
    el.src = url;
    el.load();
  }, [url, audioSource]);

  // play / pause — only relevant in file mode
  useEffect(() => {
    const el = audioRef.current;
    if (!el || audioSource !== 'file') return;
    if (isPlaying) {
      audioEngine.resume();
      el.play().catch(() => setPlaying(false));
    } else {
      el.pause();
    }
  }, [isPlaying, setPlaying, audioSource]);

  useEffect(() => { audioEngine.setVolume(volume); }, [volume]);

  return { audioRef, engine: audioEngine };
}
