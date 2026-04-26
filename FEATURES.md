# Feature Deep Dive: ChombieWombie Visualizer 💎

This document provides a technical breakdown of the advanced features and rendering logic implemented in the ChombieWombie Visualizer.

---

## 🏎️ Specialized Rendering Engines

### 1. Classic 2D Engine (Canvas API)
Built for high-contrast clarity and sharp vector movement.
- **Neon Sunrise**: A centered circular spectrum with a pinned horizon water-line.
- **Neon Mystify**: A bouncing geometric web with audio-reactive thickness.
- **Cyber Plasma**: Sine-wave based fluid color fields that morph in size and frequency.
- **Circular Dual**: Symmetrical frequency mapping for a perfectly balanced "pulse."

### 2. Immersive 3D Engine (Three.js / WebGL)
A cinematographic environment with physics-based reactivity.
- **Neon Sphere**: An icosahedron that features real-time vertex distortion and vibration instead of simple scaling.
- **Grid Runner**: An endless wireframe city skyline with a "Director Tracking" camera. Building heights are synced to the sub-bass range.
- **Bouncing Cube**: A thick-line wireframe cube with boundary-locked physics.
- **Cyber Starfield**: A high-speed particle journey with velocity mapped to the track's intensity.

---

## 📟 Advanced Post-Processing (Shader Pipeline)

The visualizer uses a multi-pass shader chain with **Additive Light Logic** to prevent image dimming.

| Filter | Logic | Brightness Strategy |
| :--- | :--- | :--- |
| **VHS** | RGB Chromatic Aberration | Uses **Additive Scanlines** that add light rather than subtracting it. |
| **CRT** | Barrel Distortion | Reduced curvature with a subtle, non-darkening vignette and high-res phosphorus lines. |
| **Glitch** | Beat-Synced Artifacts | Automatically triggers during massive audio peaks (>220 bass threshold). |

**Luminous Pipeline**: The `UnrealBloomPass` is positioned at the **end** of the chain. This allows the bloom to catch the "Additive" light from the shaders, making the entire scene feel significantly more vibrant and neon-saturated.

---

## 🎥 Cinematic Motion System

- **Director Camera Paths**: Each 3D style has a dedicated camera script (e.g., Orbit for Sphere, Hover for Terrain, Tracking for Cube).
- **LERP Smoothing**: All audio reactivity is processed through a Linear Interpolation (LERP) filter to ensure that visuals "thump" with the beat but remain smooth and professional during transitions.
- **Intensity Mapping**: Frequencies are split into **Bass** (0-10 bins) and **Average** to allow for differentiated visual reactions (e.g., scaling vs. distortion).

---

## 🎬 Technical Export Stack

1. **GPU Capture**: `canvas.captureStream(60)` records 60FPS frames directly from the WebGL context.
2. **Audio Injection**: `MediaStreamAudioDestinationNode` captures internal audio with zero latency.
3. **High-Bitrate Encoding**: The backend uses **FFmpeg** with the following parameters:
   - **Video**: H.264 (MP4) with a 12Mbps bitrate for YouTube clarity.
   - **Audio**: AAC at 320kbps for audiophile-grade sound quality.

---

## 🏷️ Brand Identity

- **Typography**: Uses the **Permanent Marker** brush font for a gritty, professional aesthetic.
- **Luminous Glow**: All branding elements feature a cyan `text-shadow` or `glow` pass to integrate them into the neon environment.

---

Developed for the ChombieWombie music ecosystem.
