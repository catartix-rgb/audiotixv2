# SONARA

> _Una instalación digital que se vuelve espacio cuando suena._

Sube un archivo de audio y la página completa se transforma en un universo
audio-reactivo: geometrías orgánicas que respiran con el bajo, partículas que se
agitan con los altos, líneas tipo osciloscopio que trazan la forma de onda en
tiempo real y redes de nodos que se reconectan al ritmo del beat.

Construido con **Next.js · React Three Fiber · GLSL · Web Audio API**. Listo
para deploy directo en **Vercel**.

---

## Demo local en 60 segundos

```bash
git clone <tu-repo> sonara
cd sonara
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000), arrastra un mp3/wav, y
listo.

> El audio se procesa **100% en el navegador** — nada se sube a ningún servidor.

---

## Deploy a Vercel

```bash
npm i -g vercel
vercel
```

O en un clic:

1. `git push` a tu repo (GitHub / GitLab / Bitbucket).
2. En Vercel: **Add New → Project → Import Git Repository**.
3. Framework: Next.js (auto-detectado). No requiere env vars. Deploy.

Vercel reconoce automáticamente Next 14 con App Router. El loader webpack para
`.glsl` (en `next.config.mjs`) se compila en el bundle.

---

## Arquitectura

```
sonara/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # fuentes (JetBrains Mono + Fraunces) + metadatos
│   ├── page.tsx                  # composición: Scene + Overlay + AudioPlayer
│   └── globals.css               # tailwind + theme + grain overlay
│
├── components/
│   ├── Scene.tsx                 # <Canvas> de R3F + Suspense + Effects
│   ├── AudioPlayer.tsx           # <audio> oculto conectado al engine
│   │
│   ├── visuals/
│   │   ├── SceneManager.tsx      # cámara cinematográfica + mode switcher
│   │   ├── OrganicGeometry.tsx   # icosaedro con displacement shader
│   │   ├── Particles.tsx         # campo de 6k puntos via ShaderMaterial
│   │   ├── Oscilloscope.tsx      # stack de líneas con datos de waveform
│   │   └── NodeNetwork.tsx       # nodos + conexiones dinámicas
│   │
│   ├── postprocessing/
│   │   └── Effects.tsx           # Bloom + ChromaticAberration + Noise + Vignette
│   │
│   └── ui/
│       ├── AudioUploader.tsx     # drag & drop
│       ├── Controls.tsx          # panel de modos, paleta y sliders
│       └── Overlay.tsx           # chrome de instalación + VU meter + atajos
│
├── hooks/
│   ├── useAudio.ts               # AudioContext + AnalyserNode + beat detection
│   └── useStore.ts               # Zustand: modo, paleta, intensidad, sensibilidad
│
├── lib/
│   └── palettes.ts               # 4 paletas (osciloscopio · amber · mono · rick)
│
└── shaders/                      # GLSL real, importado como string
    ├── organicVertex.glsl        # simplex noise displacement
    ├── organicFragment.glsl      # fresnel + audio-reactive emission
    ├── particlesVertex.glsl      # flujo orbital con jitter de altos
    └── particlesFragment.glsl    # sprites circulares aditivos
```

### Flujo de datos

```
<audio>  →  MediaElementSource  →  AnalyserNode  →  destination
                                        │
                                        ▼
                              getByteFrequencyData
                              getByteTimeDomainData
                                        │
                                        ▼
                          audioEngine.update(sensitivity)
                                        │
                          { bass, mid, high, beat, wave, freq }
                                        │
                  ┌─────────────────────┼─────────────────────┐
                  ▼                     ▼                     ▼
            uniforms GLSL          buffer updates        VU meter (rAF)
        (organic, particles)   (oscilloscope, nodes)
```

El audio se analiza una sola vez por frame (`useFrame`) y los valores viven en
un objeto mutable — **nunca pasan por React state**, por eso no hay re-render
por frame.

---

## Decisiones técnicas clave

### 1. El analyser vive **fuera** de React

`audioEngine` es una instancia singleton (`hooks/useAudio.ts`). Los visuales lo
leen directamente desde `useFrame`. Esto evita el clásico anti-patrón de
`setState(audioData)` que mata el FPS.

### 2. Shaders importados como string asset

`next.config.mjs` registra una regla webpack que convierte `.glsl/.vert/.frag`
en `asset/source`. No hay que stringificar a mano ni usar template literals
gigantes en TSX — los shaders son archivos `.glsl` reales con highlight nativo
en VSCode.

### 3. Detección de beats simple pero efectiva

En `useAudio.ts`: media móvil de 43 frames de la banda de bajos, spike cuando
el frame actual supera 1.35× el promedio (con un cooldown de 180ms para no
disparar dos veces). No es una FFT psicoacústica, pero "siente" el beat en el
~85% de la música popular.

### 4. Crossfade entre escenas

En `SceneManager.tsx` la cámara hace un pull-back de 250ms cuando cambias de
modo, ocultando el swap. Una transición real con `RenderTarget` y mezcla GLSL
sería más cinematográfica — está en el roadmap.

---

## Optimización GPU / móvil

- `dpr={[1, 2]}` en `<Canvas>` — cap de devicePixelRatio.
- `antialias: false` + bloom de calidad alta → smoothing por post.
- `multisampling={0}` en `EffectComposer` (Bloom + ChromaticAberration ya
  introducen un poco de blur).
- Geometrías compartidas y `useMemo` para todos los buffers.
- `depthWrite: false` + `AdditiveBlending` en partículas y líneas
  (evita ordenamiento por profundidad).
- `IcosahedronGeometry(1, 64)` ≈ 40k vértices — pesado en móvil bajo. Si tu
  target es móvil débil, baja a `(1, 32)` (~10k) y no se nota.
- El `NodeNetwork` recomputa links en CPU O(N²) con N=28 — trivial. Si subes a
  N>100, mueve el cálculo a un compute shader (WebGPU) o un instanced fragment.

### Banderas que puedes tocar si bajas FPS:

```ts
// components/Scene.tsx
<Canvas
  dpr={[1, 1.5]}        // ↓ aún más para móviles
  gl={{ powerPreference: 'high-performance', antialias: false }}
/>

// components/visuals/Particles.tsx
const COUNT = 3000;     // de 6000 a 3000

// components/postprocessing/Effects.tsx
<Bloom kernelSize={KernelSize.MEDIUM} mipmapBlur={false} />
```

---

## Atajos de teclado

| Tecla    | Acción              |
| -------- | ------------------- |
| `Space`  | Play / pause        |
| `M`      | Siguiente escena    |
| `H`      | Mostrar / ocultar UI |

---

## Modos visuales actuales

1. **ORGANIC** — icosaedro deformado por simplex noise, modulado por bajos
   (amplitud), medios (frecuencia) y altos (octava alta). Material fresnel.
2. **PARTICLES** — 6k puntos en órbita, jitter de altos, push radial al beat.
3. **SCOPE** — stack de 6 líneas paralelas leyendo waveform. Profundidad
   cinematográfica por opacidad.
4. **NODES** — 28 nodos en superficie esférica + grafo de conexiones que se
   reconectan según la distancia que crece con los bajos.

---

## Ideas extra para hacerlo más inmersivo

Más allá de lo que viene en el código, aquí van direcciones donde llevar el
proyecto si lo quieres como pieza de portafolio fuerte:

### Escenas alternativas
- **Tunnel** — túnel infinito en raymarching (full-screen shader) con FOV que
  se abre con el beat.
- **Fluid** — Stable Fluids GPGPU (ping-pong RT) con velocidad inyectada por
  bajos. Hay implementación de Patricio Gonzalez Vivo que puedes adaptar.
- **Terrain** — heightmap procedural, cámara surfeando sobre él, altura
  modulada por la FFT completa.
- **Typography mode** — el waveform "esculpe" tipografía SDF a escala
  arquitectónica (Rick Owens vibes).
- **Spectrum bars en 3D** — clásico pero llevado a brutalismo: 128 barras de
  hormigón flotando en un grid IR.

### Transiciones cinematográficas
- **Glitch crossfade** — RGB-shift + scanlines durante 600ms al cambiar de modo.
- **Black hole pull** — la escena vieja colapsa al centro vía vertex
  displacement inverso, la nueva emerge.
- **Whiteout** — bloom intensity →∞ por 200ms, swap, fade-in.

### Interacciones mouse/touch
- Hover sobre nodos → "imanta" partículas cercanas (force field GPGPU).
- Click sostenido → time-warp (slow-mo del shader).
- Swipe en móvil → rotación libre del scene group.
- Pinch → FOV / dolly zoom (efecto Vertigo).
- Tilt del dispositivo (DeviceOrientation API) → parallax 3D real.

### Modo "live visuals" / instalación
- **Microphone input** en vez de archivo: `getUserMedia({ audio: true })` →
  mismo flujo. Para shows.
- **MIDI clock** vía Web MIDI API para sincronizar con un DJ.
- **OSC bridge** (websocket) para controlar parámetros desde TouchOSC o
  Resolume.
- **Fullscreen + cursor hide** después de 3s de inactividad — modo museo.
- **Screen recorder** integrado vía `MediaRecorder` para capturar el output.

### Pulido para portafolio
- **Letterboxing dinámico** durante "momentos clave" del audio para dar
  cinematic ratio.
- **Subtítulos del track** parseados desde metadata ID3 (jsmediatags), tipografía
  enorme en abrupt cuts.
- **Espacio compartido**: dos personas se conectan por WebRTC y ven el mismo
  audio sincronizado en distintos navegadores.
- **Captura con `gl.readPixels`** + export a PNG en momento "frozen" — el
  usuario se lleva un cartel generativo de su canción.

---

## Estética / referencias

- **Verde osciloscopio** (`#3DFFA2`) sobre **negro absoluto** (`#050505`).
- Acentos **ámbar suave** (`#F2E255`) en highlights de beat.
- Tipografía: **Fraunces** display (italic 600) + **JetBrains Mono** para chrome.
- **Marcas en esquinas** estilo viewfinder, brutalismo CRT.
- **Grain SVG** sobre todo, mix-blend-mode overlay al 4% — sutil pero presente.
- Inspirado en: Rick Owens (paleta bone), interfaces de Refik Anadol, demos de
  Three.js de Akella, NULL Group, Daniel Wyatt.

---

## Compatibilidad

| Navegador      | Estado                       |
| -------------- | ---------------------------- |
| Chrome/Edge    | ✅ Completo                  |
| Firefox        | ✅ Completo                  |
| Safari desktop | ✅ Completo                  |
| iOS Safari     | ✅ Requiere user-gesture     |
| Android Chrome | ✅ DPR cap recomendado       |

Web Audio API requiere un user-gesture para iniciar — por eso el flujo es
"upload → autoplay" tras el drop/click. No reproduces nada hasta que el usuario
toque algo.

---

## Roadmap

- [ ] Worklet processor en lugar de AnalyserNode (latencia más baja).
- [ ] WebGPU backend opcional para shaders compute.
- [ ] GPGPU fluid sim como 5° modo.
- [ ] Export de loop como GIF/MP4.
- [ ] PWA + offline.

---

## Licencia

MIT — úsalo, fórkealo, móntalo en tu galería digital. Si lo usas para algo
público me encantaría verlo. ✦
