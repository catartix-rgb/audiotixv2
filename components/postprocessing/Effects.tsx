'use client';

import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
  Noise,
} from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import { useStore } from '@/hooks/useStore';
import { audioEngine } from '@/hooks/useAudio';
import { Vector2 } from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export function Effects() {
  const bloom = useStore((s) => s.bloom);
  const offset = useMemo(() => new Vector2(0.0012, 0.0008), []);
  const bloomRef = useRef<any>(null);
  const caRef = useRef<any>(null);

  // Drive bloom + chromatic aberration from the live audio so every hit
  // flashes the whole frame. punch decays in ~50ms, so these read as slams.
  useFrame(() => {
    const f = audioEngine.frame;

    if (bloomRef.current) {
      // base bloom · steady energy lift · EXPLOSIVE punch spike
      const target =
        0.7 * bloom * (1 + f.energy * 0.5) + f.punch * 2.8 * bloom;
      // ease up fast, fall with punch — feels like a strobe hit on each kick
      bloomRef.current.intensity += (target - bloomRef.current.intensity) * 0.6;
    }

    if (caRef.current && caRef.current.offset) {
      // RGB split jolts outward on every punch / transient
      const amt = 0.0012 + f.punch * 0.007 + f.transient * 0.003;
      caRef.current.offset.set(amt, amt * 0.7);
    }
  });

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        ref={bloomRef}
        intensity={0.7 * bloom}
        luminanceThreshold={0.16}
        luminanceSmoothing={0.85}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />
      <ChromaticAberration
        ref={caRef}
        blendFunction={BlendFunction.NORMAL}
        offset={offset}
        radialModulation={false}
        modulationOffset={0}
      />
      <Noise opacity={0.04} premultiply blendFunction={BlendFunction.OVERLAY} />
      <Vignette eskil={false} offset={0.15} darkness={0.85} />
    </EffectComposer>
  );
}
