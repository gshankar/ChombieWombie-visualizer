# ChombieWombie Visualizer 🚀

Transform your music into stunning, high-end 3D and 2D visualizations. **ChombieWombie Visualizer** is a professional-grade production tool built with Three.js and the Web Audio API, designed for creators who need YouTube-ready visuals with a retro-futuristic soul.

![ChombieWombie Banner](https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=2070)

## ✨ Core Features

### 🏎️ Studio Render Engine (New)
- **Background Rendering**: No more real-time waiting. Process videos as fast as your hardware allows.
- **Headless Pipeline**: Uses Puppeteer and Metal GPU acceleration to render every frame deterministically.
- **Master Quality**: 1080p 60FPS video with 320kbps AAC audio.

### 🎨 Dual Immersive Engines
- **Classic 2D Engine**: High-fidelity vector visuals (Neon Sunrise, Cyber Plasma, etc.).
- **Immersive 3D Engine**: Cinematic WebGL environments (Grid Runner, Bouncing Cube, etc.).

### 🎥 Cinematographic Motion
- **Director Camera Paths**: Each 3D style features a unique, cinematic camera path that follows the energy of the music.
- **Dynamic Post-Processing**: Bloom and filters pulse in real-time with audio peaks.

---

## 💻 Recommended Hardware Specifications
For optimal performance with the **Studio Render Engine**, we recommend high-end hardware (e.g., Mac Studio):

| Component | Recommended Spec | Rationale |
| :--- | :--- | :--- |
| **CPU** | Apple M1 Max / M2 Ultra (or 12+ Core Intel/AMD) | Parallel FFmpeg encoding & audio analysis. |
| **GPU** | 32+ Core GPU (Metal / Vulkan support) | High-speed headless WebGL frame rendering. |
| **RAM** | 32GB+ | Handling large audio frequency maps and browser instances. |
| **Storage** | NVMe SSD | Fast frame-buffer piping and video writing. |
| **OS** | macOS (for Metal acceleration) or Linux with GPU drivers | Leverages hardware-specific GPU APIs for headless rendering. |

---

## 🛠️ Setup & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- [FFmpeg](https://ffmpeg.org/) (Installed on your system path)

### 1. Backend Setup (Video Encoder & Studio Engine)
```bash
cd backend
npm install
npm start
```
*The backend runs on http://localhost:3001*

### 2. Frontend Setup (Visualizer Dashboard)
```bash
cd frontend
npm install
npm run dev
```
*The visualizer runs on http://localhost:5173*

---

## 📖 How to Use

1. **Upload Track**: Drag and drop your audio file into the **"Visualize your Mixes"** zone.
2. **Configure Visuals**: Choose your Engine, Style, and Palette.
3. **Studio Render**: Click **Record Video**. The app will:
   - Perform an **Offline Analysis** of the audio.
   - Launch the **Background Render Engine**.
   - Automatically download the final **Master MP4** when finished.
4. **Preview**: Hit **Play** to see the cinematographic motion in real-time before rendering.

---

## 🚀 Technologies Used
- **Frontend**: Vite, Three.js, Web Audio API (Offline Rendering).
- **Backend**: Puppeteer (Headless Browser), Node.js, Fluent-FFmpeg.
- **GPU API**: Metal (via Chrome ANGLE).

---

Developed with ❤️ by the ChombieWombie Team.
