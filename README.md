# ChombieWombie Visualizer 🚀

Transform your music into stunning, YouTube-optimized 3D and 2D visualizations. **ChombieWombie** is a high-performance music visualizer built with Three.js and the Web Audio API, featuring professional-grade filters and direct MP4 video export.

![ChombieWombie Banner](https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=2070)

## ✨ Core Features

### 🎨 Dual Rendering Engines
- **2D Classic Mode**: High-fidelity, sharp vector-style visuals (Circular Spectrum, Linear Bars, Oscilloscope).
- **3D Immersive Mode**: WebGL-powered 3D environments (Audio Sphere, Retro Terrain, Hyper Tunnel).

### 🎬 Professional Video Export
- **One-Click Recording**: Capture your session in real-time.
- **High-Bitrate Encoding**: Backend FFmpeg integration transcodes browser recordings into YouTube-ready `.mp4` files with high-quality AAC audio.

### 🎭 Retro Post-Processing Filters
- **VHS Mode**: RGB shift, noise, and color bleed for that nostalgic 90s look.
- **CRT Scanlines**: Simulated cathode-ray tube curvature and scanlines.
- **Glitch Engine**: Automatic beat-detection driven glitching and strobe effects.

### 🏷️ Branding & Customization
- **Logo Watermark**: Drag and drop your logo into the dashboard. Position and scale it as a professional watermark.
- **Dynamic Palettes**: Choose from curated neon palettes or enable **Color Cycle (Rainbow Mode)**.
- **Audio Sensitivity**: Fine-tune how reactive the visuals are to your specific track.

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

1. **Upload Track**: Drag and drop your audio file (MP3, WAV, FLAC) into the center area.
2. **Configure Visuals**:
   - Select your **Rendering Engine** (2D or 3D).
   - Choose a **Visual Style**.
   - Pick a **Color Palette**.
3. **Add Branding**: Drag your logo into the Branding section in the side panel and adjust its position.
4. **Preview**: Hit **Play** to see the visualization in real-time.
5. **Export**: Click **Record Video**. The app will play through your track and automatically download the final `.mp4` file when finished.

---

## 🧪 Running Tests

### Backend Tests (API & Encoding)
```bash
cd backend
npm test
```

### Frontend Tests (Logic & Config)
```bash
cd frontend
npm test
```

---

## 🚀 Technologies Used
- **Frontend**: Vite, Three.js, Vanilla JS, CSS Glassmorphism.
- **Backend**: Node.js, Express, Multer, Fluent-FFmpeg.
- **Audio**: Web Audio API (AnalyserNode).

---

Developed with ❤️ by the ChombieWombie Team.
