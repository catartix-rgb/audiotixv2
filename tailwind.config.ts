import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#050505',
          900: '#0a0a0a',
          800: '#111111',
          700: '#1a1a1a',
          500: '#2a2a2a',
          300: '#666666',
          100: '#cfcfcf',
          50: '#f5f5f5',
        },
        osc: {
          DEFAULT: '#3DFFA2',   // verde osciloscopio
          soft: '#7CFFC4',
          dim: '#0E3D26',
        },
        amber: {
          glow: '#F2E255',
          soft: '#EFD27A',
        },
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        display: ['var(--font-display)', 'serif'],
      },
      letterSpacing: {
        wider2: '0.18em',
      },
    },
  },
  plugins: [],
};

export default config;
