'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  BufferAttribute,
  LineBasicMaterial,
  Line,
  Color,
  AdditiveBlending,
} from 'three';
import { audioEngine } from '@/hooks/useAudio';
import { useStore } from '@/hooks/useStore';
import { getActivePalette } from '@/lib/palettes';

const POINTS = 512;
const RINGS = 6;
const SPACING = 0.55;

/**
 * Stack of parallel oscilloscope lines that read live waveform data.
 * Feels like a frozen analog scope cluster.
 */
export function Oscilloscope() {
  const groupRef = useRef<any>(null);
  const sensitivity = useStore((s) => s.sensitivity);
  const intensity = useStore((s) => s.intensity);
  const paletteName = useStore((s) => s.palette);
  const autoColor = useStore((s) => s.autoColor);

  const lines = useMemo(() => {
    const arr: { geom: BufferGeometry; mat: LineBasicMaterial; line: Line }[] = [];
    for (let r = 0; r < RINGS; r++) {
      const positions = new Float32Array(POINTS * 3);
      for (let i = 0; i < POINTS; i++) {
        const x = (i / (POINTS - 1) - 0.5) * 4.5;
        positions[i * 3 + 0] = x;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = (r - (RINGS - 1) / 2) * SPACING;
      }
      const geom = new BufferGeometry();
      geom.setAttribute('position', new BufferAttribute(positions, 3));
      const mat = new LineBasicMaterial({
        color: new Color('#3DFFA2'),
        transparent: true,
        opacity: 1 - Math.abs(r - (RINGS - 1) / 2) / RINGS,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const line = new Line(geom, mat);
      arr.push({ geom, mat, line });
    }
    return arr;
  }, []);

  useFrame((state, delta) => {
    const frame = audioEngine.update(sensitivity);
    const wave = frame.wave;
    const step = wave.length / POINTS;
    const palette = getActivePalette(paletteName, autoColor);

    // Voice + transient add ribbon-like wave amplitude on top of the raw audio
    const voiceLift = frame.voice * 0.8;
    const transientShock = frame.transient * 1.5 + frame.punch * 2.0;

    for (let r = 0; r < RINGS; r++) {
      const { geom, mat } = lines[r];
      const attr = geom.getAttribute('position') as BufferAttribute;
      const ringPhase = (r / RINGS) * 0.15;
      const ringOffset = r * 17; // each ring reads a slightly different window of the waveform
      for (let i = 0; i < POINTS; i++) {
        const v = wave[Math.floor(i * step + ringOffset) % wave.length];
        // map 0..255 to -1..1, then boost by intensity + voice + transient
        const y =
          ((v - 128) / 128) *
            (1.0 + intensity * 0.8 + voiceLift + transientShock) +
          ringPhase * frame.bass;
        attr.setY(i, y);
      }
      attr.needsUpdate = true;
      // tint shifts on beat OR transient
      const flashAmt = Math.max(frame.beat * 0.7, frame.transient * 0.9, frame.punch);
      mat.color.copy(palette.base).lerp(palette.highlight, flashAmt);
      // opacity also pulses
      const baseOpacity = 1 - Math.abs(r - (RINGS - 1) / 2) / RINGS;
      mat.opacity = baseOpacity * (0.6 + frame.energy * 0.7);
    }

    if (groupRef.current) {
      // gentle camera-friendly drift with voice-driven sway
      groupRef.current.rotation.y =
        Math.sin(state.clock.elapsedTime * 0.15) * 0.25 +
        frame.voice * 0.08;
      groupRef.current.rotation.x = Math.cos(state.clock.elapsedTime * 0.1) * 0.1;
      groupRef.current.position.y = frame.transient * 0.08 + frame.punch * 0.15; // jump on hits
      const ps = 1 + frame.punch * 0.12;
      groupRef.current.scale.setScalar(ps);  // whole stack expands on punch
    }
  });

  return (
    <group ref={groupRef}>
      {lines.map((l, i) => (
        <primitive key={i} object={l.line} />
      ))}
    </group>
  );
}
