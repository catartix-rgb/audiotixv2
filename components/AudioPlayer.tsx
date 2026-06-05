'use client';

import { useAudio } from '@/hooks/useAudio';
import { useStore } from '@/hooks/useStore';

/**
 * Headless <audio> host. Renders an invisible element that the audio engine
 * connects to via createMediaElementSource. The Web Audio analyser does the rest.
 */
export function AudioPlayer() {
  const { audioRef } = useAudio();
  const setPlaying = useStore((s) => s.setPlaying);
  return (
    <audio
      ref={audioRef}
      onEnded={() => setPlaying(false)}
      crossOrigin="anonymous"
      preload="auto"
      style={{ display: 'none' }}
    />
  );
}
