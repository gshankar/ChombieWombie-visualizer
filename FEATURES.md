# Feature Deep Dive: ChombieWombie Visualizer 💎

This document provides a detailed breakdown of the technical features and creative options available in ChombieWombie.

---

## 🏎️ Rendering Engines

### 2D Classic (Canvas API)
Built for speed and clarity. The 2D engine is perfect for "Sharp" visuals that need to stand out on high-resolution displays.
- **Circular Spectrum**: Maps audio frequencies to a ring. Supports **Outward**, **Inward**, and **Dual** (symmetry) modes.
- **Linear Bars**: A traditional frequency-bin bar chart, grounded at the bottom of the screen.
- **Oscilloscope**: A real-time waveform representation of the audio signal.

### 3D Retro (Three.js / WebGL)
An immersive environment with depth, lighting, and camera movement.
- **Audio Sphere**: A pulsing icosahedron that scales with bass and glows based on overall intensity.
- **Retro Terrain**: A wireframe plane that undulates with radial waves driven by the audio spectrum.
- **Hyper Tunnel**: A reactive cylinder that creates a "speeding" effect through a neon grid.

---

## 🎬 Video Export Engine

ChombieWombie uses a hybrid approach for video generation:
1. **Real-time Capture**: Uses `canvas.captureStream(60)` to record frames directly from the browser's GPU at 60FPS.
2. **Audio Merging**: The audio is captured from a `MediaStreamAudioDestinationNode` to ensure zero sync-drift.
3. **Backend Transcoding**: The raw WebM stream is sent to a Node.js backend where **FFmpeg** performs a high-quality transcode to H.264 (MP4) with AAC audio.

---

## 📟 Post-Processing Filters (Shaders)

These filters are applied directly to the 3D scene using Three.js `EffectComposer`:

| Filter | Effect | Logic |
| :--- | :--- | :--- |
| **VHS** | Nostalgic analog distortion | RGB chromatic aberration, scan-line noise, and slight color bleeding. |
| **CRT** | 80s monitor simulation | Screen curvature (barrel distortion) and phosphor scanlines. |
| **Glitch** | Digital chaos | Random displacement and strobe effects. Can be toggled manually or set to trigger automatically on heavy bass drops. |

---

## 🏷️ Branding & Customization

- **Watermark System**: Supports any image format (PNG, JPG, SVG). The logo is rendered as a 2D overlay on top of both the 2D and 3D engines.
- **Positioning**: Fixed grid positioning (Top-Left, Top-Right, Bottom-Left, Bottom-Right, Center).
- **Color Cycling**: Uses HSL hue rotation to smoothly transition the entire visualizer's color scheme over time, creating a rainbow effect.

---

## 🧪 Stability & Testing

- **Engine Lock**: To prevent WebGL context crashes, the rendering engine is locked during active playback/recording.
- **Unit Testing**: 
    - **Frontend**: Vitest ensures that style configurations and UI mappings are correct.
    - **Backend**: Supertest verifies the encoding API status and error handling.
