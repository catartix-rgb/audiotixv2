'use client';

import { useCallback, useState } from 'react';
import { useStore } from '@/hooks/useStore';
import { useSystemAudio } from '@/hooks/useSystemAudio';

export function AudioUploader() {
  const setAudio = useStore((s) => s.setAudio);
  const setPlaying = useStore((s) => s.setPlaying);
  const setAudioSource = useStore((s) => s.setAudioSource);
  const [dragOver, setDragOver] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { start: startSystem } = useSystemAudio();

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('audio/')) return;
      const url = URL.createObjectURL(file);
      setAudioSource('file');
      setAudio(url, file.name);
      setPlaying(true);
    },
    [setAudio, setPlaying, setAudioSource],
  );

  const handleSystem = useCallback(async () => {
    setMsg('Selecciona una pestaña y marca "Compartir audio"…');
    const res = await startSystem();
    if (!res.ok) setMsg(res.message ?? 'No se pudo capturar el audio.');
    else setMsg(null);
  }, [startSystem]);

  return (
    <div
      className={`relative pointer-events-auto select-none transition-all duration-500 ${
        dragOver ? 'scale-[1.01]' : 'scale-100'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
      }}
    >
      <div
        className={`border border-osc/30 ${dragOver ? 'border-osc' : ''} px-10 py-14 text-center backdrop-blur-sm bg-black/40 transition-colors`}
        style={{
          boxShadow: dragOver
            ? '0 0 40px rgba(61,255,162,0.25), inset 0 0 40px rgba(61,255,162,0.06)'
            : 'inset 0 0 30px rgba(61,255,162,0.04)',
        }}
      >
        <div className="font-mono text-[10px] tracking-wider2 text-osc/60 mb-6">
          ░░ SONARA / INPUT ░░
        </div>
        <div className="font-display text-3xl md:text-4xl text-ink-50 mb-3">
          Convierte sonido en espacio
        </div>
        <div className="font-mono text-xs text-ink-300 mb-8">
          arrastra un archivo · o captura lo que suena ahora
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {/* file upload */}
          <label className="cursor-pointer">
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <div className="inline-block border border-osc/40 px-6 py-3 font-mono text-[11px] tracking-wider2 text-osc hover:bg-osc/10 transition-colors">
              ○ &nbsp; SUBIR ARCHIVO
            </div>
          </label>

          {/* system capture */}
          <button
            onClick={handleSystem}
            className="border border-amber-glow/50 px-6 py-3 font-mono text-[11px] tracking-wider2 text-amber-glow hover:bg-amber-glow/10 transition-colors"
          >
            ◉ &nbsp; CAPTURAR AUDIO DEL SISTEMA
          </button>
        </div>

        {msg && (
          <div className="mt-5 font-mono text-[10px] text-amber-glow/80 max-w-sm mx-auto leading-relaxed">
            {msg}
          </div>
        )}

        <div className="mt-6 font-mono text-[9px] text-ink-300/70 leading-relaxed max-w-sm mx-auto">
          mp3 · wav · flac · ogg · m4a — o reproduce Spotify / YouTube / Ableton
          en una pestaña y captúrala en vivo (Chrome/Edge).
        </div>
      </div>
    </div>
  );
}
