'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  IcosahedronGeometry,
  ShaderMaterial,
  Mesh,
  Color,
  BufferGeometry,
  BufferAttribute,
  Points,
  AdditiveBlending,
  Group,
} from 'three';
import { audioEngine } from '@/hooks/useAudio';
import { useStore } from '@/hooks/useStore';
import { getActivePalette } from '@/lib/palettes';

import meshVertex from '@/shaders/ferrofluidVertex.glsl';
import meshFragment from '@/shaders/ferrofluidFragment.glsl';
import dropVertex from '@/shaders/dropletVertex.glsl';
import dropFragment from '@/shaders/dropletFragment.glsl';

const DROPLET_COUNT = 600;

/**
 * Ferrofluid mode = Voronoi spike mesh + ballistic droplet cloud.
 *
 * The mesh handles surface behavior (columns, tearing, depletion).
 * The droplets handle the "fluid divides" feeling — pieces detach,
 * arc through space with gravity, evaporate. Their ejection energy
 * tracks bass envelope + transients.
 */
export function Ferrofluid() {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const intensity = useStore((s) => s.intensity);
  const sensitivity = useStore((s) => s.sensitivity);
  const paletteName = useStore((s) => s.palette);
  const autoColor = useStore((s) => s.autoColor);

  // ---- MESH (the main fluid body) ------------------------------------
  const meshGeometry = useMemo(() => new IcosahedronGeometry(1, 128), []);
  const seed = useMemo(() => Math.random() * 100, []);

  const meshUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBass: { value: 0 },
      uBassEnv: { value: 0 },
      uMid: { value: 0 },
      uHigh: { value: 0 },
      uVoice: { value: 0 },
      uTransient: { value: 0 },
      uPunch: { value: 0 },
      uBeat: { value: 0 },
      uEnergy: { value: 0 },
      uIntensity: { value: intensity },
      uSeed: { value: seed },
      uColorBase: { value: new Color() },
      uColorAccent: { value: new Color() },
      uColorHighlight: { value: new Color() },
    }),
    [seed],
  );

  // ---- DROPLETS -------------------------------------------------------
  const dropGeometry = useMemo(() => {
    const geom = new BufferGeometry();
    // Each droplet has a static "home" direction on a sphere (gets randomized
    // per cycle inside the shader anyway, but this provides initial spread).
    const positions = new Float32Array(DROPLET_COUNT * 3);
    const homes = new Float32Array(DROPLET_COUNT * 3);
    const seeds = new Float32Array(DROPLET_COUNT);
    const speeds = new Float32Array(DROPLET_COUNT);
    for (let i = 0; i < DROPLET_COUNT; i++) {
      // uniform sphere sampling
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const sx = Math.sin(phi) * Math.cos(theta);
      const sy = Math.sin(phi) * Math.sin(theta);
      const sz = Math.cos(phi);
      positions[i * 3 + 0] = sx;
      positions[i * 3 + 1] = sy;
      positions[i * 3 + 2] = sz;
      homes[i * 3 + 0] = sx;
      homes[i * 3 + 1] = sy;
      homes[i * 3 + 2] = sz;
      seeds[i] = Math.random();
      // Speed varies: some droplets fly far, others stay close
      speeds[i] = 0.5 + Math.random() * 1.5;
    }
    geom.setAttribute('position', new BufferAttribute(positions, 3));
    geom.setAttribute('aHome', new BufferAttribute(homes, 3));
    geom.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    geom.setAttribute('aSpeed', new BufferAttribute(speeds, 1));
    return geom;
  }, []);

  const dropUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBass: { value: 0 },
      uBassEnv: { value: 0 },
      uMid: { value: 0 },
      uHigh: { value: 0 },
      uVoice: { value: 0 },
      uTransient: { value: 0 },
      uPunch: { value: 0 },
      uBeat: { value: 0 },
      uIntensity: { value: intensity },
      uPixelRatio: {
        value: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1,
      },
      uColorBase: { value: new Color() },
      uColorHighlight: { value: new Color() },
    }),
    [],
  );

  const dropMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: dropVertex,
        fragmentShader: dropFragment,
        uniforms: dropUniforms,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [dropUniforms],
  );

  const rotState = useRef({
    speed: 0.015 + Math.random() * 0.025,
    phaseX: Math.random() * 10,
    phaseY: Math.random() * 10,
    phaseZ: Math.random() * 10,
  });

  useFrame((_, delta) => {
    const frame = audioEngine.update(sensitivity);
    const palette = getActivePalette(paletteName, autoColor);

    // shared time
    meshUniforms.uTime.value += delta;
    dropUniforms.uTime.value += delta;

    // sync audio uniforms to both
    const audioUniforms = [meshUniforms, dropUniforms];
    audioUniforms.forEach((u) => {
      u.uBass.value = frame.bass;
      u.uBassEnv.value = frame.bassEnv;
      u.uMid.value = frame.mid;
      u.uHigh.value = frame.high;
      u.uVoice.value = frame.voice;
      u.uTransient.value = frame.transient;
      u.uPunch.value = frame.punch;
      u.uBeat.value = frame.beat;
      u.uIntensity.value = intensity;
    });
    meshUniforms.uEnergy.value = frame.energy;

    // palette
    meshUniforms.uColorBase.value.copy(palette.accent);
    meshUniforms.uColorAccent.value.copy(palette.base);
    meshUniforms.uColorHighlight.value.copy(palette.highlight);
    dropUniforms.uColorBase.value.copy(palette.base);
    dropUniforms.uColorHighlight.value.copy(palette.highlight);

    if (groupRef.current) {
      const t = meshUniforms.uTime.value;
      const r = rotState.current;
      const speedMod = 1.0 + 0.4 * Math.sin(t * 0.07 + r.phaseX);
      groupRef.current.rotation.y += delta * r.speed * speedMod;
      groupRef.current.rotation.x =
        Math.sin(t * 0.11 + r.phaseY) * 0.08 +
        Math.sin(t * 0.27 + r.phaseZ) * 0.03;
      groupRef.current.rotation.z = Math.cos(t * 0.08 + r.phaseZ) * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} geometry={meshGeometry}>
        <shaderMaterial
          vertexShader={meshVertex}
          fragmentShader={meshFragment}
          uniforms={meshUniforms}
          transparent
        />
      </mesh>
      <points geometry={dropGeometry} material={dropMaterial} />
    </group>
  );
}
