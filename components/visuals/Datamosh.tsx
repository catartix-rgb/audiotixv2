'use client';

import { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  PlaneGeometry,
  ShaderMaterial,
  Mesh,
  Texture,
  DataTexture,
  RedFormat,
  UnsignedByteType,
  LinearFilter,
  ClampToEdgeWrapping,
  VideoTexture,
  TextureLoader,
  Vector2,
} from 'three';
import { audioEngine } from '@/hooks/useAudio';
import { useStore } from '@/hooks/useStore';

import vertex from '@/shaders/datamoshVertex.glsl';
import fragment from '@/shaders/datamoshFragment.glsl';

/**
 * Builds a single-row Red-only DataTexture used as waveform input.
 * Updated every frame from the analyser's time-domain data.
 */
function createWaveformTexture(length: number) {
  const data = new Uint8Array(length);
  data.fill(128);
  const tex = new DataTexture(data, length, 1, RedFormat, UnsignedByteType);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.wrapS = ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function Datamosh() {
  const meshRef = useRef<Mesh>(null);
  const intensity = useStore((s) => s.intensity);
  const sensitivity = useStore((s) => s.sensitivity);
  const mediaUrl = useStore((s) => s.mediaUrl);
  const mediaType = useStore((s) => s.mediaType);
  const { size, viewport } = useThree();

  // texture refs
  const textureRef = useRef<Texture | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  // shared waveform texture
  const waveformTex = useMemo(() => createWaveformTexture(512), []);

  const uniforms = useMemo(
    () => ({
      uTexture: { value: null as Texture | null },
      uWaveform: { value: waveformTex },
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uHigh: { value: 0 },
      uVoice: { value: 0 },
      uTransient: { value: 0 },
      uBeat: { value: 0 },
      uIntensity: { value: intensity },
      uResolution: { value: new Vector2(size.width, size.height) },
      uHasTexture: { value: 0 },
    }),
    [waveformTex],
  );

  // load image / video when mediaUrl changes
  useEffect(() => {
    if (!mediaUrl) {
      uniforms.uTexture.value = null;
      uniforms.uHasTexture.value = 0;
      textureRef.current?.dispose();
      textureRef.current = null;
      if (videoElRef.current) {
        videoElRef.current.pause();
        videoElRef.current = null;
      }
      return;
    }

    if (mediaType === 'video') {
      const video = document.createElement('video');
      video.src = mediaUrl;
      video.crossOrigin = 'anonymous';
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.play().catch(() => {});
      videoElRef.current = video;
      const vt = new VideoTexture(video);
      vt.minFilter = LinearFilter;
      vt.magFilter = LinearFilter;
      uniforms.uTexture.value = vt;
      uniforms.uHasTexture.value = 1;
      textureRef.current = vt;
    } else if (mediaType === 'image') {
      const loader = new TextureLoader();
      loader.load(mediaUrl, (tex) => {
        tex.minFilter = LinearFilter;
        tex.magFilter = LinearFilter;
        uniforms.uTexture.value = tex;
        uniforms.uHasTexture.value = 1;
        textureRef.current = tex;
      });
    }

    return () => {
      textureRef.current?.dispose();
    };
  }, [mediaUrl, mediaType, uniforms]);

  // keep resolution uniform fresh
  useEffect(() => {
    uniforms.uResolution.value.set(size.width, size.height);
  }, [size, uniforms]);

  useFrame((_, delta) => {
    const frame = audioEngine.update(sensitivity);
    uniforms.uTime.value += delta;
    uniforms.uBass.value = frame.bass;
    uniforms.uMid.value = frame.mid;
    uniforms.uHigh.value = frame.high;
    uniforms.uVoice.value = frame.voice;
    uniforms.uTransient.value = frame.transient;
    uniforms.uBeat.value = frame.beat;
    uniforms.uIntensity.value = intensity;

    // push live waveform into the texture
    const wf = waveformTex.image.data as Uint8Array;
    const src = frame.wave;
    const step = src.length / wf.length;
    for (let i = 0; i < wf.length; i++) {
      wf[i] = src[Math.floor(i * step)];
    }
    waveformTex.needsUpdate = true;
  });

  // sized to fit the canvas roughly — slightly bigger than viewport for headroom
  const planeSize = useMemo(() => {
    const aspect = size.width / size.height;
    const h = 5;
    return [h * aspect, h] as [number, number];
  }, [size]);

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry args={planeSize} />
      <shaderMaterial
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent={false}
      />
    </mesh>
  );
}
