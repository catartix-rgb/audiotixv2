import { Color } from 'three';
import type { PaletteName } from '@/hooks/useStore';

export interface Palette {
  bg: Color;        // background tint (usually near-black)
  base: Color;      // primary stroke/particle color
  accent: Color;    // secondary accent
  highlight: Color; // beat / peak highlight
}

const c = (hex: string) => new Color(hex);

export const palettes: Record<PaletteName, Palette> = {
  osciloscopio: {
    bg: c('#050505'),
    base: c('#3DFFA2'),
    accent: c('#0E3D26'),
    highlight: c('#F2E255'),
  },
  amber: {
    bg: c('#070604'),
    base: c('#F2E255'),
    accent: c('#7a6116'),
    highlight: c('#fffaf0'),
  },
  monocromo: {
    bg: c('#000000'),
    base: c('#f5f5f5'),
    accent: c('#444444'),
    highlight: c('#ffffff'),
  },
  rick: {
    bg: c('#030303'),
    base: c('#cdb89b'),     // bone
    accent: c('#3a2f25'),   // espresso
    highlight: c('#e8e4dc'),// off-white
  },
};

export function getPalette(name: PaletteName): Palette {
  return palettes[name];
}

// Returns the live generative palette when autoColor is on, else the static one.
// Imported lazily to avoid a circular module-load issue.
import { colorEngine } from './colorEngine';
export function getActivePalette(name: PaletteName, autoColor: boolean): Palette {
  return autoColor ? colorEngine.palette : palettes[name];
}
