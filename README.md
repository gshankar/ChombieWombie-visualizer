# ChombieWombie Visualizer 🚀

Transform your music into stunning, high-end 3D and 2D visualizations. **ChombieWombie Visualizer** is a professional-grade production tool built with Three.js and the Web Audio API, designed for creators who need YouTube-ready visuals with a retro-futuristic soul.

![ChombieWombie Banner](https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=2070)

## ✨ Core Features

### 🎨 Dual Immersive Engines
- **Classic 2D Engine**: High-fidelity vector visuals.
  - *Styles*: Circular (In/Out/Dual), Neon Sunrise, Neon Mystify, Cyber Plasma, and Linear Bars.
- **Immersive 3D Engine**: Cinematic WebGL environments.
  - *Styles*: Neon Sphere (Distorted), Grid Terrain, Warp Tunnel, Cyber Starfield, Bouncing Cube, and Grid Runner.

### 🎥 Cinematographic Motion
- **Director Camera Paths**: Each 3D style features a unique, cinematic camera path (Orbiting, Drifting, Tracking) that follows the energy of the music.
- **Dynamic Post-Processing**: Bloom intensity and glitch filters pulse in real-time with audio peaks, creating a living, breathing light show.

### 🎬 One-Click MP4 Export
- **Real-time Recording**: Capture your session at 60FPS directly in the browser.
- **Professional Transcoding**: Backend FFmpeg integration converts recordings into high-bitrate `.mp4` files with crisp AAC audio, optimized for social media and YouTube.

### 🎭 Retro-Futuristic Filters
- **VHS Distortion**: Chromatic aberration, color bleed, and additive glow scanlines.
- **CRT Simulation**: Barrel curvature and high-resolution phosphorus scanlines.
- **Luminous Glitch**: Automatic, beat-synced digital artifacts that "pop" during massive drops.

### 🏷️ Brand Integration
- **Custom Typography**: Styled with the official **ChombieWombie** brush-script aesthetic.
- **Session Branding**: Support for custom logo watermarks with precise positioning and scaling.
- **Dynamic Palettes**: Curated neon color systems with optional **Color Cycle** (Rainbow Mode).

---

## 🛠️ Setup & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- [FFmpeg](https://ffmpeg.org/) (Installed on your system path)

### 1. Backend Setup (Video Encoder)
```bash
cd backend
npm install
npm start
```
*The backend runs on http://localhost:3001*

### 2. Frontend Setup (Visualizer)
```bash
cd frontend
npm install
npm run dev
```
*The visualizer runs on http://localhost:5173*

---

## 📖 How to Use

1. **Upload Track**: Drag and drop your audio file into the **"Visualize your Mixes"** zone.
2. **Configure Visuals**:
   - Choose your **Engine** and **Style**.
   - Pick a **Color Palette** or enable **Cycle Colors**.
   - Set the **Cycle Visuals** timer (default 60s) for a dynamic set.
3. **Toggle Filters**: Enable VHS, CRT, or Glitch modes for that analog aesthetic.
4. **Preview**: Hit **Play** to witness the cinematographic motion.
5. **Export**: Click **Record Video**. The app will play through your track and automatically download the final `.mp4`.

---

## 🚀 Technologies Used
- **Frontend**: Vite, Three.js, Vanilla JS, CSS Glassmorphism.
- **Backend**: Node.js, Express, Fluent-FFmpeg.
- **Audio**: Web Audio API (AnalyserNode with LERP smoothing).

---

Developed with ❤️ by the ChombieWombie Team.
