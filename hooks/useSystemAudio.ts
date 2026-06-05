'use client';

import { useCallback, useRef } from 'react';
import { audioEngine } from './useAudio';
import { useStore } from './useStore';

/**
 * useSystemAudio — capture the computer's audio via the Screen Capture API.
 *
 * HOW IT WORKS / LIMITATIONS (important):
 *  - We call getDisplayMedia({ video, audio }). The browser shows a picker.
 *  - To get audio, the user MUST pick a **Browser Tab** (or, on Windows,
 *    "Entire Screen") and tick **"Share tab audio" / "Share system audio"**.
 *  - Chrome & Edge (desktop): full support. Tab audio always; system audio
 *    on Windows when sharing the whole screen.
 *  - Firefox: limited (no tab audio capture in most versions).
 *  - Safari: getDisplayMedia audio is not supported — falls back gracefully.
 *  - macOS: cannot capture full *system* audio (OS limitation); capture a
 *    Chrome TAB instead (e.g. the YouTube/Spotify-web tab) and share its audio.
 *
 * For Spotify desktop app / Ableton (native apps), browser capture can't see
 * them on macOS. The reliable cross-source path on macOS is a virtual audio
 * device (BlackHole / Loopback) routed into a Chrome tab. On Windows, "share
 * system audio" captures everything.
 */
export function useSystemAudio() {
  const setLiveActive = useStore((s) => s.setLiveActive);
  const setAudioSource = useStore((s) => s.setAudioSource);
  const setAudio = useStore((s) => s.setAudio);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      return { ok: false, message: 'Tu navegador no soporta captura de pantalla/audio.' };
    }
    try {
      // video:true is REQUIRED for the audio track to be offered in Chrome.
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 1 }, // minimal — we discard video, just need the audio offer
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        return {
          ok: false,
          message:
            'No se capturó audio. Vuelve a intentar y marca la casilla "Compartir audio de la pestaña / del sistema".',
        };
      }

      // We don't need the video frames. Keep the track alive (stopping it can
      // end the whole capture in some browsers) but never render it.
      streamRef.current = stream;

      // If the user stops sharing from the browser's native bar, clean up.
      audioTracks[0].addEventListener('ended', () => stop());
      stream.getVideoTracks().forEach((vt) =>
        vt.addEventListener('ended', () => stop()),
      );

      audioEngine.resume();
      audioEngine.attachStream(stream);

      setAudioSource('system');
      setLiveActive(true);
      setAudio('', 'AUDIO DEL SISTEMA · LIVE'); // marks hasAudio = true, shows controls
      return { ok: true };
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        return { ok: false, message: 'Permiso de captura cancelado.' };
      }
      return { ok: false, message: 'No se pudo iniciar la captura: ' + (err?.message ?? err) };
    }
  }, [setAudioSource, setLiveActive, setAudio]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLiveActive(false);
  }, [setLiveActive]);

  return { start, stop };
}
