'use client';

import { Canvas } from '@react-three/fiber';
import { SceneManager } from './visuals/SceneManager';
import { Effects } from './postprocessing/Effects';
import { Suspense } from 'react';

export function Scene() {
  return (
    <Canvas
      gl={{
        antialias: false,           // FXAA-ish vibe + cheaper; post handles smoothing
        powerPreference: 'high-performance',
        alpha: false,
      }}
      dpr={[1, 2]}                  // cap DPR for retina mobile
      camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 50 }}
      style={{ position: 'fixed', inset: 0 }}
    >
      <Suspense fallback={null}>
        <SceneManager />
        <Effects />
      </Suspense>
    </Canvas>
  );
}
