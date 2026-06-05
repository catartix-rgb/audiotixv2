'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferGeometry,
  BufferAttribute,
  ShaderMaterial,
  Points,
  AdditiveBlending,
  Color,
} from 'three';
import { audioEngine } from '@/hooks/useAudio';
import { useStore } from '@/hooks/useStore';
import { getActivePalette } from '@/lib/palettes';

import vertex from '@/shaders/particlesVertex.glsl';
import fragment from '@/shaders/particlesFragment.glsl';

const COUNT = 6000;

export function Particles() {
  const pointsRef = useRef<Points>(null);
  const popRef = useRef(1);
  const intensity = useStore((s) => s.intensity);
  const sensitivity = useStore((s) => s.sensitivity);
  const paletteName = useStore((s) => s.palette);
  const autoColor = useStore((s) => s.autoColor);
  const { viewport } = useThree();

  const geometry = useMemo(() => {
    const geom = new BufferGeometry();
    const positions = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT);
    const radii = new Float32Array(COUNT);
    const speeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3 + 0] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      seeds[i] = Math.random();
      // Wider radius spread + clustering — looks more nebula-like
      radii[i] = 0.6 + Math.pow(Math.random(), 0.6) * 3.0;
      // Speeds bias toward small range with occasional fast outliers
      speeds[i] = (Math.random() - 0.5) * (Math.random() < 0.1 ? 4 : 1.5);
    }
    geom.setAttribute('position', new BufferAttribute(positions, 3));
    geom.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    geom.setAttribute('aRadius', new BufferAttribute(radii, 1));
    geom.setAttribute('aSpeed', new BufferAttribute(speeds, 1));
    return geom;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uHigh: { value: 0 },
      uVoice: { value: 0 },
      uTransient: { value: 0 },
      uPunch: { value: 0 },
      uBeat: { value: 0 },
      uIntensity: { value: intensity },
      uPixelRatio: {
        value:
          typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1,
      },
      uColorBase: { value: new Color() },
      uColorHighlight: { value: new Color() },
    }),
    [],
  );

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [uniforms],
  );

  const rotState = useRef({
    speedY: 0.04 + Math.random() * 0.06,
    speedX: (Math.random() - 0.5) * 0.04,
    phase: Math.random() * 10,
  });

  useFrame((_, delta) => {
    const frame = audioEngine.update(sensitivity);
    uniforms.uTime.value += delta;
    uniforms.uBass.value = frame.bass;
    uniforms.uMid.value = frame.mid;
    uniforms.uHigh.value = frame.high;
    uniforms.uVoice.value = frame.voice;
    uniforms.uTransient.value = frame.transient;
    uniforms.uBeat.value = frame.beat;
    uniforms.uPunch.value = frame.punch;
    uniforms.uIntensity.value = intensity;
    const p = getActivePalette(paletteName, autoColor);
    uniforms.uColorBase.value.copy(p.base);
    uniforms.uColorHighlight.value.copy(p.highlight);

    if (pointsRef.current) {
      const t = uniforms.uTime.value;
      const r = rotState.current;
      const mod = 1 + 0.5 * Math.sin(t * 0.08 + r.phase);
      pointsRef.current.rotation.y += delta * r.speedY * mod;
      pointsRef.current.rotation.x += delta * r.speedX;
      pointsRef.current.rotation.z = Math.sin(t * 0.06 + r.phase) * 0.15;

      // explosive expansion of the whole cloud on each punch
      const target = 1 + frame.punch * 0.9 * intensity;
      popRef.current += (target - popRef.current) * Math.min(1, delta * 28);
      pointsRef.current.scale.setScalar(popRef.current);
    }
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}
