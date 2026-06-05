import { Scene } from '@/components/Scene';
import { Overlay } from '@/components/ui/Overlay';
import { AudioPlayer } from '@/components/AudioPlayer';

export default function HomePage() {
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-ink-950">
      <Scene />
      <Overlay />
      <AudioPlayer />
    </main>
  );
}
