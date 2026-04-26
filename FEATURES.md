# Feature Deep Dive: ChombieWombie Visualizer 💎

This document provides a technical breakdown of the advanced features and rendering logic implemented in the ChombieWombie Visualizer.

---

## 🏎️ Studio Render Engine (Headless Pipeline)

The **Studio Render Engine** is designed for high-end workstations (Mac Studio, Threadripper, etc.) to process music videos at maximum speed and quality.

### 1. Offline Audio Analysis
Unlike real-time playback, the Studio Engine pre-scans the audio file using an `OfflineAudioContext`.
- **Sampling**: Analyzes the frequency spectrum at exactly 60 intervals per second.
- **Accuracy**: Eliminates sample drift, ensuring the visuals remain perfectly locked to the beat even if the browser frame-rate dips.

### 2. Deterministic Headless Rendering
Uses **Puppeteer** to load the visualizer in a headless browser state.
- **Frame Stepping**: Instead of relying on a system clock, the backend manually triggers each frame (`window.renderFrame`). 
- **Metal GPU Support**: Leverages the Mac Studio's GPU architecture (`--use-angle=metal`) to render 1080p WebGL frames in milliseconds.
- **Pipelined Encoding**: Each frame is captured as a PNG buffer and piped directly into an FFmpeg stdin stream, minimizing disk I/O.

---

## 📟 Advanced Post-Processing (Shader Pipeline)

The visualizer uses a multi-pass shader chain with **Additive Light Logic** to prevent image dimming.

| Filter | Logic | Brightness Strategy |
| :--- | :--- | :--- |
| **VHS** | RGB Chromatic Aberration | Uses **Additive Scanlines** that add light rather than subtracting it. |
| **CRT** | Barrel Distortion | Reduced curvature with a subtle, non-darkening vignette. |
| **Glitch** | Beat-Synced Artifacts | Automatically triggers during massive audio peaks (>220 bass threshold). |

---

## 🎬 Master Quality Specifications

The Studio Render Engine outputs files with the following specifications:

- **Format**: MP4 (H.264 / MPEG-4 AVC).
- **Resolution**: 1920x1080 (Full HD).
- **Framerate**: 60 FPS (Constant).
- **Video Bitrate**: 12 - 18 Mbps (YouTube High-Bitrate Standard).
- **Audio Codec**: AAC (Advanced Audio Coding).
- **Audio Bitrate**: 320 kbps (Studio Quality).

---

## 💻 Recommended Hardware

| Component | Target Performance |
| :--- | :--- |
| **CPU** | 12+ Threads (for FFmpeg's `libx264` parallel encoding). |
| **GPU** | 8GB+ VRAM (for handling complex Three.js scenes and shaders in headless mode). |
| **RAM** | 32GB (essential for large JSON audio maps and Puppeteer memory overhead). |

---

Developed for the ChombieWombie music ecosystem.
