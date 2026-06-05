'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { IcosahedronGeometry, ShaderMaterial, Mesh, Color, Vector3 } from 'three';
import { audioEngine } from '@/hooks/useAudio';
import { useStore } from '@/hooks/useStore';
import { getActivePalette } from '@/lib/palettes';

import vertex from '@/shaders/organicVertex.glsl';
import fragment from '@/shaders/organicFragment.glsl';

export function OrganicGeometry() {
  const meshRef = useRef<Mesh>(null);
  const matRef = useRef<ShaderMaterial>(null);
  const popRef = useRef(1);
  const intensity = useStore((s) => s.intensity);
  const sensitivity = useStore((s) => s.sensitivity);
  const paletteName = useStore((s) => s.palette);
  const autoColor = useStore((s) => s.autoColor);

  const geometry = useMemo(() => new IcosahedronGeometry(1, 64), []);
  const seed = useMemo(() => Math.random() * 100, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uHigh: { value: 0 },
      uVoice: { value: 0 },
      uTransient: { value: 0 },
      uBeat: { value: 0 },
      uPunch: { value: 0 },
      uEnergy: { value: 0 },
      uIntensity: { value: intensity },
      uSeed: { value: seed },
      uColorBase: { value: new Color() },
      uColorAccent: { value: new Color() },
      uColorHighlight: { value: new Color() },
    }),
    [seed],
  );

  // Per-session rotation state with phase randomization
  const rotState = useRef({
    baseSpeedY: 0.06 + Math.random() * 0.06,
    baseSpeedX: 0.02 + Math.random() * 0.03,
    phaseA: Math.random() * 10,
    phaseB: Math.random() * 10,
  });

  useFrame((state, delta) => {
    const frame = audioEngine.update(sensitivity);
    const u = uniforms;
    u.uTime.value += delta;
    u.uBass.value = frame.bass;
    u.uMid.value = frame.mid;
    u.uHigh.value = frame.high;
    u.uVoice.value = frame.voice;
    u.uTransient.value = frame.transient;
    u.uBeat.value = frame.beat;
    u.uPunch.value = frame.punch;
    u.uEnergy.value = frame.energy;
    u.uIntensity.value = intensity;

    const p = getActivePalette(paletteName, autoColor);
    u.uColorBase.value.copy(p.base);
    u.uColorAccent.value.copy(p.accent);
    u.uColorHighlight.value.copy(p.highlight);

    if (meshRef.current) {
      const t = u.uTime.value;
      const r = rotState.current;
      const yMod = 1.0 + 0.5 * Math.sin(t * 0.06 + r.phaseA);
      meshRef.current.rotation.y += delta * r.baseSpeedY * yMod;
      meshRef.current.rotation.x =
        Math.sin(t * 0.15 + r.phaseB) * 0.18 +
        Math.sin(t * 0.4) * 0.04;

      // EXPLOSIVE scale pop on every punch — smoothed toward rest between hits
      const target = 1 + frame.punch * 0.85 * intensity;
      popRef.current += (target - popRef.current) * Math.min(1, delta * 30);
      meshRef.current.scale.setScalar(popRef.current);
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <shaderMaterial
        ref={matRef}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent={false}
      />
    </mesh>
  );
}
