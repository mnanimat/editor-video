# 🎬 Editor de Vídeo MNAnimat

**Editor de vídeo profissional de nível Hollywood** com efeitos WebGL, color grading cinema, motion design avançado, exportação HD/4K, suporte a Windows, Android e Browser.

---

## ✨ Funcionalidades

### 🎞️ Edição de Vídeo
- Timeline multi-trilha (vídeo, áudio, texto) ilimitada
- Ferramentas: Seleção, Navalha, Ripple Edit, Slip
- Drag & drop de mídia
- Undo/Redo ilimitado
- Snap inteligente (clips, playhead, grid)

### 🎨 Color Grading (Nível Cinema)
- **Rodas de Cor** Lift/Gamma/Gain/Offset (como DaVinci Resolve)
- **Curvas RGB** com editor bezier interativo
- **HSL Secundário** por faixa de cor (7 canais)
- **Qualificador** para correção seletiva por cor
- **LUTs 3D** com 12+ presets cinematográficos + import .cube
- **Scopes**: Waveform, Parade RGB, Vectorscope, Histograma
- Quick Color: Exposição, Contraste, Highlights, Shadows, Temperatura, Tint

### ✨ Efeitos Visuais (WebGL/GLSL)
- Glow Cinemático, Bloom, Lens Flare
- Chroma Key (Green Screen) com spill suppression
- Motion Blur Cinematográfico
- Depth of Field (Tilt-Shift)
- God Rays / Luz Solar
- Distorção de Calor, Ripple, Fish-Eye
- Film Grain, Vinheta, Aberração Cromática
- Glitch RGB, VHS Retrô, Scanlines
- Neon Glow, Pixelate, Halftone

### 🌟 Sistema de Partículas
- Fogo, Fumaça, Chuva, Neve, Faíscas
- Bokeh Generator, Dust Motes, Starfield
- Parâmetros: vida, velocidade, gravidade, fade

### 🔄 Transições
- Cross Dissolve, Fade to Black
- Wipe, Slide Push, Spin, Zoom Blur
- Glitch, Light Burn, Iris Circle

### 🎯 Motion Designer
- Keyframes animáveis para: Posição, Escala, Rotação, Opacidade
- 8 tipos de Easing: Linear, Ease, Bounce, Elastic, Spring
- Presets: Zoom In/Out, Pan, Ken Burns, Float, Shake, Bounce In, Typewriter
- Editor visual de curvas de velocidade
- Preview de animação em tempo real

### 🔊 Audio Engine
- Mixer multi-trilha com faders e VU meters
- EQ paramétrico 7 bandas
- Compressor/Limiter com gráfico
- Reverb (sintético)
- Mute, Solo, Pan por trilha

### 📝 Títulos e Gráficos
- Lower Third, Title Card, Subtítulos, Kinetic Text, End Credits
- 8 fontes profissionais (Google Fonts)
- 8 animações de entrada
- Editor de texto integrado

### 📤 Exportação
- Formatos: MP4 (H.264), WebM (VP9), GIF
- Resoluções: 480p → 4K DCI Cinema
- Presets: YouTube, Instagram Reels, TikTok, Twitter, Cinema 4K
- Exportação via MediaRecorder API (sem servidor)

---

## 🚀 Como Usar

### No Browser (Imediato)
1. Abra `index.html` em qualquer navegador moderno (Chrome, Edge, Firefox)
2. Arraste vídeos para o painel de mídia
3. Clique duplo para adicionar à timeline
4. Edite, aplique efeitos e exporte!

### No Windows (Electron)
```bash
# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm run dev

# Build instalador .exe
npm run build:win
```
O instalador será gerado em `dist/CineForge-Pro-Setup-1.0.0-x64.exe`

### No Android (APK)
1. Abra a pasta `android/` no **Android Studio** (Ladybug ou superior)
2. **Copie os arquivos web** para `android/app/src/main/assets/www/`:
   ```
   android/app/src/main/assets/www/
   ├── index.html
   ├── manifest.json
   ├── sw.js
   └── src/
       ├── css/
       └── js/
   ```
3. Conecte um dispositivo Android ou inicie um emulador
4. Clique em **Run ▶** no Android Studio
5. Para gerar o APK:
   - Menu: **Build → Generate Signed Bundle/APK**
   - Escolha APK → Next
   - Configure keystore (ou crie um novo)
   - Escolha `release` → Finish
   - APK em: `android/app/release/app-release.apk`

### Como PWA (Android/Desktop)
1. Abra `index.html` no Chrome/Edge
2. Clique no ícone de instalação na barra de endereço (ou menu → "Instalar app")
3. O CineForge Pro será instalado como aplicativo nativo!

---

## ⌨️ Atalhos de Teclado

| Atalho | Função |
|--------|--------|
| `Espaço` | Play/Pause |
| `V` | Ferramenta Seleção |
| `C` | Ferramenta Navalha |
| `H` | Ferramenta Mão |
| `Ctrl+Z` | Desfazer |
| `Ctrl+Y` | Refazer |
| `Ctrl+I` | Importar Mídia |
| `Ctrl+E` | Exportar |
| `Home` | Ir ao início |
| `End` | Ir ao fim |
| `←/→` | Frame anterior/próximo |
| `Shift+←/→` | -1s / +1s |
| `Delete` | Excluir clipe selecionado |
| `F` | Tela cheia |
| `F1-F6` | Páginas (Editar, Cor, Efeitos, Motion, Áudio, Exportar) |

---

## 🛠️ Estrutura do Projeto

```
Editor de Vídeo/
├── index.html              # App principal
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
├── package.json            # Electron config
├── src/
│   ├── css/main.css        # Design system cinema dark
│   └── js/
│       ├── core/           # EventBus, Project, App
│       ├── renderer/       # VideoRenderer WebGL
│       ├── effects/        # ColorGrading, EffectsEngine, MotionDesigner, Transitions
│       ├── timeline/       # Timeline engine
│       ├── audio/          # AudioEngine (Web Audio API)
│       ├── ui/             # UIManager, Inspector
│       └── export/         # Exporter (MediaRecorder)
├── electron/
│   ├── main.js             # Electron main process
│   └── preload.js          # Context bridge
└── android/
    ├── build.gradle
    ├── settings.gradle
    └── app/
        ├── build.gradle
        └── src/main/
            ├── AndroidManifest.xml
            ├── java/com/cineforge/pro/
            │   ├── MainActivity.kt     # WebView + native bridge
            │   └── CineForgeApp.kt
            └── res/
                ├── layout/activity_main.xml
                └── values/ (strings, colors, themes)
```

---

## 🔧 Requisitos

### Browser
- Chrome 90+ / Edge 90+ / Firefox 85+ (WebGL 2.0 necessário)
- Hardware: GPU com suporte a WebGL 2.0

### Windows (Electron)
- Windows 10/11 (64-bit)
- Node.js 18+ e npm
- 4GB RAM mínimo, 8GB recomendado
- GPU com drivers atualizados

### Android (APK)
- Android 8.0 (API 26) ou superior
- Android Studio Ladybug (2024.2.1) ou superior
- JDK 17
- Android SDK 34
- Dispositivo com Chrome WebView atualizado

---

## 📋 Tecnologias

| Tecnologia | Uso |
|------------|-----|
| WebGL 2.0 | Renderização e efeitos de vídeo |
| GLSL 300 es | Shaders cinematográficos |
| Web Audio API | Motor de áudio multi-trilha |
| Canvas 2D API | Timeline, curvas, scopes |
| MediaRecorder API | Exportação de vídeo |
| CSS3 (Grid, Variables, Animations) | Interface |
| Electron 28 | Wrapper Windows |
| Kotlin + WebView | App Android |
| Service Worker | PWA offline |

---

## 🎬 Inspirações

Design e funcionalidades inspirados em:
- **DaVinci Resolve** (color grading, scopes, timeline)
- **Adobe Premiere Pro** (layout, effects)
- **Final Cut Pro** (motion, magnetic timeline)
- **After Effects** (keyframes, expressions)

---

*CineForge Pro v1.0.0 — Desenvolvido para edição cinematográfica profissional*
