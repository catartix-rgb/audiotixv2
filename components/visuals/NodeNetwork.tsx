'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  BufferAttribute,
  LineSegments,
  LineBasicMaterial,
  Mesh,
  SphereGeometry,
  MeshBasicMaterial,
  Group,
  Color,
  Vector3,
  AdditiveBlending,
} from 'three';
import { audioEngine } from '@/hooks/useAudio';
import { useStore } from '@/hooks/useStore';
import { getActivePalette } from '@/lib/palettes';

const NODE_COUNT = 32;
const MAX_LINK_DIST = 1.6;

export function NodeNetwork() {
  const groupRef = useRef<Group>(null);
  const linesRef = useRef<LineSegments>(null);
  const sensitivity = useStore((s) => s.sensitivity);
  const intensity = useStore((s) => s.intensity);
  const paletteName = useStore((s) => s.palette);
  const autoColor = useStore((s) => s.autoColor);

  // Each node has its OWN drift vector + phase set, so even at rest
  // the network looks alive and never repeats.
  const nodes = useMemo(() => {
    const arr: {
      pos: Vector3;
      basePos: Vector3;
      driftAxis: Vector3;
      driftSpeed: number;
      mesh: Mesh;
      phase: number;
      wobbleFreq: number;
    }[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.3 + Math.random() * 0.7;
      const pos = new Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      );
      const mesh = new Mesh(
        new SphereGeometry(0.035, 12, 12),
        new MeshBasicMaterial({ color: new Color('#3DFFA2'), transparent: true }),
      );
      mesh.position.copy(pos);
      arr.push({
        pos: pos.clone(),
        basePos: pos.clone(),
        // Random drift axis — each node "wants" to wander in its own direction
        driftAxis: new Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5,
        ).normalize(),
        driftSpeed: 0.3 + Math.random() * 0.7,
        mesh,
        phase: Math.random() * 6.28,
        // wobble frequency varies per node (no clean ratios)
        wobbleFreq: 0.4 + Math.random() * 0.8,
      });
    }
    return arr;
  }, []);

  const { lineGeom, lineMat } = useMemo(() => {
    const maxLinks = (NODE_COUNT * (NODE_COUNT - 1)) / 2;
    const positions = new Float32Array(maxLinks * 2 * 3);
    const geom = new BufferGeometry();
    geom.setAttribute('position', new BufferAttribute(positions, 3));
    geom.setDrawRange(0, 0);
    const mat = new LineBasicMaterial({
      color: new Color('#3DFFA2'),
      transparent: true,
      opacity: 0.35,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    return { lineGeom: geom, lineMat: mat };
  }, []);

  const rotState = useRef({
    speedY: 0.04 + Math.random() * 0.08,
    phase: Math.random() * 10,
  });

  useFrame((state, delta) => {
    const frame = audioEngine.update(sensitivity);
    const palette = getActivePalette(paletteName, autoColor);
    const t = state.clock.elapsedTime;

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const wobble = 0.1 * (1 + intensity);
      // Per-node multi-axis wandering with personal frequencies
      const wx = Math.sin(t * n.wobbleFreq + n.phase) * wobble;
      const wy = Math.cos(t * n.wobbleFreq * 0.83 + n.phase * 1.3) * wobble;
      const wz = Math.sin(t * n.wobbleFreq * 1.17 + n.phase * 0.7) * wobble;
      // Slow secondary drift along this node's axis
      const drift = n.driftAxis.clone().multiplyScalar(
        Math.sin(t * 0.15 * n.driftSpeed + n.phase) * 0.18
      );

      // Voice = global node breathing (all nodes pulse together with vocals)
      const voicePump = 1 + frame.voice * 0.45 * intensity;
      // Transient = sudden outward shock
      const transientPush = 1 + frame.transient * 0.35 * intensity + frame.punch * 0.6 * intensity;

      n.pos
        .copy(n.basePos)
        .multiplyScalar(
          (1 + frame.bass * 0.5 * intensity) * voicePump * transientPush
        )
        .add(new Vector3(wx, wy, wz))
        .add(drift);

      n.mesh.position.copy(n.pos);
      (n.mesh.material as MeshBasicMaterial).color
        .copy(palette.base)
        .lerp(palette.highlight, Math.max(frame.beat, frame.transient * 0.9, frame.punch));
      // Scale jumps on every hit — punch makes nodes burst dramatically
      const s =
        1 +
        frame.energy * 1.6 +
        frame.beat * 1.2 +
        frame.transient * 1.8 +
        frame.punch * 3.0 +
        frame.voice * 0.5;
      n.mesh.scale.setScalar(s);
    }

    const posAttr = lineGeom.getAttribute('position') as BufferAttribute;
    let writeIdx = 0;
    const maxDist = MAX_LINK_DIST * (0.8 + frame.bass * 0.6);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = nodes[i].pos.distanceTo(nodes[j].pos);
        if (d < maxDist) {
          posAttr.array[writeIdx + 0] = nodes[i].pos.x;
          posAttr.array[writeIdx + 1] = nodes[i].pos.y;
          posAttr.array[writeIdx + 2] = nodes[i].pos.z;
          posAttr.array[writeIdx + 3] = nodes[j].pos.x;
          posAttr.array[writeIdx + 4] = nodes[j].pos.y;
          posAttr.array[writeIdx + 5] = nodes[j].pos.z;
          writeIdx += 6;
        }
      }
    }
    posAttr.needsUpdate = true;
    lineGeom.setDrawRange(0, writeIdx / 3);
    lineMat.color.copy(palette.base).lerp(palette.highlight, Math.max(frame.beat * 0.7, frame.transient * 0.8));
    lineMat.opacity = 0.18 + frame.energy * 0.9 + frame.voice * 0.4;

    if (groupRef.current) {
      const r = rotState.current;
      const mod = 1 + 0.4 * Math.sin(t * 0.07 + r.phase);
      groupRef.current.rotation.y += delta * r.speedY * mod;
      groupRef.current.rotation.x =
        Math.sin(t * 0.2 + r.phase) * 0.18 +
        Math.sin(t * 0.5) * 0.04;
    }
  });

  return (
    <group ref={groupRef}>
      {nodes.map((n, i) => (
        <primitive key={i} object={n.mesh} />
      ))}
      <lineSegments ref={linesRef} geometry={lineGeom} material={lineMat} />
    </group>
  );
}
