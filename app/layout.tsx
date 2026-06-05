import type { Metadata } from 'next';
import { JetBrains_Mono, Fraunces } from 'next/font/google';
import './globals.css';

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['300', '400', '500'],
});

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['300', '400', '600'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'SONARA — un universo generado por sonido',
  description:
    'Instalación digital audio-reactiva: sube un sonido y observa cómo se vuelve espacio.',
  openGraph: {
    title: 'SONARA',
    description: 'Audio · partículas · luz.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${mono.variable} ${display.variable}`}>
      <body className="grain">{children}</body>
    </html>
  );
}
