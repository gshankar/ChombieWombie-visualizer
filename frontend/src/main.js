import './style.css'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { VHSShader, GlitchShader, CRTShader } from './shaders.js'
import { STYLES, DEFAULT_CONFIG } from './config.js'

// State management
let audioContext, analyser, source, dataArray, animationId, mediaRecorder;
let recordedChunks = [];
let audioFile, audioSource;
let brandImage = null;
let hueOffset = 0;
let cycleInterval = null;

// Dual Engine Support
const canvas2d = document.getElementById('visualizer-2d');
const ctx2d = canvas2d.getContext('2d');
const canvas3d = document.getElementById('visualizer-3d');
let scene, camera, renderer, composer;
let vhsPass, glitchPass, crtPass;
let sphere, terrain, tunnel;

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const uploadError = document.getElementById('upload-error');
const loadingOverlay = document.getElementById('loading-overlay');

const trackInput = document.getElementById('track-input');
const trackBtn = document.getElementById('track-btn');
const trackSlot = document.getElementById('track-slot');

const playBtn = document.getElementById('play-btn');
const stopPreviewBtn = document.getElementById('stop-preview-btn');
const recordBtn = document.getElementById('record-btn');
const statusBadge = document.getElementById('status');
const engineSelect = document.getElementById('engine-select');
const styleSelect = document.getElementById('style-select');
const palettes = document.querySelectorAll('.palette');
const recordingOverlay = document.getElementById('recording-overlay');
const sensitivitySlider = document.getElementById('sensitivity');
const colorCycleToggle = document.getElementById('color-cycle-toggle');
const cycleToggle = document.getElementById('cycle-toggle');
const cycleSelection = document.getElementById('cycle-selection');
const cycleStyleCheckboxes = document.querySelectorAll('.cycle-style');

// Toggles for Filters
const vhsToggle = document.getElementById('vhs-toggle');
const crtToggle = document.getElementById('crt-toggle');
const glitchToggle = document.getElementById('glitch-toggle');

const brandBtn = document.getElementById('brand-btn');
const brandInput = document.getElementById('brand-input');
const brandScale = document.getElementById('brand-scale');
const brandPos = document.getElementById('brand-pos');
const brandControls = document.getElementById('brand-controls');
const brandDropZone = document.getElementById('brand-drop-zone');
const brandPreview = document.getElementById('brand-preview');

// Config
let config = { ...DEFAULT_CONFIG };

// --- Initialization ---

function init() {
  updateStyleOptions();
  resize();
  initThree();
}

function updateStyleOptions() {
  styleSelect.innerHTML = STYLES[config.engine].map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  config.style = STYLES[config.engine][0].id;
}

function resize() {
  canvas2d.width = canvas2d.offsetWidth * window.devicePixelRatio;
  canvas2d.height = canvas2d.offsetHeight * window.devicePixelRatio;
  if (renderer) {
    renderer.setSize(canvas3d.offsetWidth, canvas3d.offsetHeight);
    camera.aspect = canvas3d.offsetWidth / canvas3d.offsetHeight;
    camera.updateProjectionMatrix();
  }
}
window.addEventListener('resize', resize);

function initThree() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, canvas3d.offsetWidth / canvas3d.offsetHeight, 0.1, 1000);
  camera.position.z = 5;

  renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(canvas3d.offsetWidth, canvas3d.offsetHeight);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
  composer.addPass(bloomPass);

  vhsPass = new ShaderPass(VHSShader); vhsPass.enabled = false; composer.addPass(vhsPass);
  glitchPass = new ShaderPass(GlitchShader); glitchPass.enabled = false; composer.addPass(glitchPass);
  crtPass = new ShaderPass(CRTShader); crtPass.enabled = false; composer.addPass(crtPass);

  // Sphere
  sphere = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.5, 32),
    new THREE.MeshPhongMaterial({ color: config.colors[0], wireframe: true })
  );
  scene.add(sphere);

  // Terrain
  terrain = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30, 64, 64),
    new THREE.MeshPhongMaterial({ color: config.colors[1], wireframe: true, side: THREE.DoubleSide })
  );
  terrain.rotation.x = -Math.PI / 2; terrain.position.y = -2.5;
  scene.add(terrain);

  // Tunnel
  tunnel = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5, 100, 32, 100, true),
    new THREE.MeshPhongMaterial({ color: config.colors[0], wireframe: true, side: THREE.BackSide })
  );
  tunnel.rotation.x = Math.PI / 2;
  scene.add(tunnel);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const p = new THREE.PointLight(0xffffff, 1); p.position.set(5, 5, 5); scene.add(p);
}

// --- Audio ---

async function setupAudio() {
  if (audioContext) await audioContext.close();
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  const buffer = await audioFile.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(buffer);
  audioSource = audioContext.createBufferSource();
  audioSource.buffer = audioBuffer;
  audioSource.connect(analyser);
  analyser.connect(audioContext.destination);
  dataArray = new Uint8Array(analyser.frequencyBinCount);
  return audioSource;
}

// --- Rendering Loop ---

function draw() {
  animationId = requestAnimationFrame(draw);
  if (analyser) analyser.getByteFrequencyData(dataArray);

  if (colorCycleToggle.checked) {
    hueOffset = (hueOffset + 1) % 360;
    config.colors = [
      `hsl(${hueOffset}, 100%, 50%)`,
      `hsl(${(hueOffset + 60) % 360}, 100%, 50%)`
    ];
  }

  if (config.engine === '2d') {
    draw2D();
  } else {
    draw3D();
  }
}

function draw2D() {
  const w = canvas2d.width;
  const h = canvas2d.height;
  ctx2d.clearRect(0, 0, w, h);
  
  const bars = dataArray.length;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 4;
  const sens = config.sensitivity;

  ctx2d.strokeStyle = config.colors[0];
  ctx2d.lineWidth = 3;
  ctx2d.lineCap = 'round';

  if (config.style.startsWith('circular')) {
    for (let i = 0; i < bars; i++) {
      const barHeight = (dataArray[i] / 255) * r * (sens / 5);
      const angle = (i / bars) * Math.PI * 2;
      let x1, y1, x2, y2;

      if (config.style === 'circular') {
        x1 = cx + Math.cos(angle) * r; y1 = cy + Math.sin(angle) * r;
        x2 = cx + Math.cos(angle) * (r + barHeight); y2 = cy + Math.sin(angle) * (r + barHeight);
      } else if (config.style === 'circular-inner') {
        x1 = cx + Math.cos(angle) * r; y1 = cy + Math.sin(angle) * r;
        x2 = cx + Math.cos(angle) * (r - barHeight); y2 = cy + Math.sin(angle) * (r - barHeight);
      } else {
        x1 = cx + Math.cos(angle) * (r - barHeight/2); y1 = cy + Math.sin(angle) * (r - barHeight/2);
        x2 = cx + Math.cos(angle) * (r + barHeight/2); y2 = cy + Math.sin(angle) * (r + barHeight/2);
      }
      ctx2d.beginPath(); ctx2d.moveTo(x1, y1); ctx2d.lineTo(x2, y2); ctx2d.stroke();
    }
  } else if (config.style === 'bars') {
    const barWidth = (w / bars) * 2;
    for (let i = 0; i < bars; i++) {
      const barHeight = (dataArray[i] / 255) * h * 0.5 * (sens / 5);
      ctx2d.fillStyle = config.colors[0];
      ctx2d.fillRect(i * (barWidth + 1), h - barHeight, barWidth, barHeight);
    }
  } else if (config.style === 'wave') {
    ctx2d.beginPath();
    const sliceWidth = w / bars;
    let x = 0;
    for (let i = 0; i < bars; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * h / 2;
      if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
      x += sliceWidth;
    }
    ctx2d.stroke();
  }

  if (brandImage) drawBranding(ctx2d, w, h);
}

function draw3D() {
  const time = performance.now() * 0.001;
  const avg = analyser ? (dataArray.reduce((a, b) => a + b) / dataArray.length) : 0;
  const bass = analyser ? dataArray[0] : 0;
  const intensity = (avg / 255) * config.sensitivity;

  sphere.visible = config.style === '3d-sphere';
  terrain.visible = config.style === '3d-terrain';
  tunnel.visible = config.style === '3d-tunnel';

  if (sphere.visible) {
    sphere.scale.set(1 + bass/255 * 0.3, 1 + bass/255 * 0.3, 1 + bass/255 * 0.3);
    sphere.rotation.y += 0.01;
    sphere.material.color.set(config.colors[0]);
  }
  
  if (terrain.visible) {
    const pos = terrain.geometry.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i+2] = Math.sin(pos[i] * 0.2 + time) * intensity * 2;
    }
    terrain.geometry.attributes.position.needsUpdate = true;
    terrain.material.color.set(config.colors[1]);
  }

  if (tunnel.visible) {
    tunnel.position.z += 0.2 + (avg / 255);
    if (tunnel.position.z > 50) tunnel.position.z = 0;
    tunnel.rotation.z += 0.005;
    tunnel.material.color.set(config.colors[0]);
  }

  vhsPass.enabled = vhsToggle.checked;
  crtPass.enabled = crtToggle.checked;
  glitchPass.enabled = glitchToggle.checked;

  composer.render();
  
  // Also draw branding on 2D canvas as overlay
  ctx2d.clearRect(0, 0, canvas2d.width, canvas2d.height);
  if (brandImage) drawBranding(ctx2d, canvas2d.width, canvas2d.height);
}

function drawBranding(ctx, w, h) {
  const scale = brandScale.value / 100;
  const bw = brandImage.width * scale;
  const bh = brandImage.height * scale;
  const padding = 40;
  let bx, by;
  
  switch(brandPos.value) {
    case 'top-right': bx = w - bw - padding; by = padding; break;
    case 'top-left': bx = padding; by = padding; break;
    case 'bottom-right': bx = w - bw - padding; by = h - bh - padding; break;
    case 'bottom-left': bx = padding; by = h - bh - padding; break;
    case 'center': bx = (w - bw) / 2; by = (h - bh) / 2; break;
  }
  ctx.drawImage(brandImage, bx, by, bw, bh);
}

// --- Handlers ---

engineSelect.onchange = (e) => {
  config.engine = e.target.value;
  canvas2d.classList.toggle('hidden', config.engine === '3d');
  canvas3d.classList.toggle('hidden', config.engine === '2d');
  
  // Special: when in 3D, we show 2D canvas as transparent overlay for branding
  if (config.engine === '3d') {
    canvas2d.classList.remove('hidden');
    canvas2d.style.pointerEvents = 'none';
  } else {
    canvas2d.style.pointerEvents = 'auto';
  }
  
  updateStyleOptions();
};

styleSelect.onchange = (e) => config.style = e.target.value;
sensitivitySlider.oninput = (e) => config.sensitivity = e.target.value;

dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); };
dropZone.ondragleave = () => dropZone.classList.remove('drag-over');
dropZone.ondrop = (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFile(e.dataTransfer.files[0]);
};

trackBtn.onclick = () => trackInput.click();
trackInput.onchange = (e) => handleFile(e.target.files[0]);

function handleFile(file) {
  if (file && file.type.startsWith('audio/')) {
    audioFile = file;
    trackSlot.classList.add('ready');
    trackSlot.querySelector('.slot-status').textContent = 'Received';
    setTimeout(() => {
      dropZone.classList.add('hidden');
      playBtn.disabled = false;
      recordBtn.disabled = false;
      statusBadge.textContent = 'Session Ready: ' + audioFile.name;
    }, 500);
  } else {
    showError('Please upload a valid audio track to begin.');
  }
}

brandBtn.onclick = () => brandInput.click();
brandInput.onchange = (e) => handleBrandFile(e.target.files[0]);

brandDropZone.ondragover = (e) => { e.preventDefault(); brandDropZone.classList.add('drag-over'); };
brandDropZone.ondragleave = () => brandDropZone.classList.remove('drag-over');
brandDropZone.ondrop = (e) => {
  e.preventDefault();
  brandDropZone.classList.remove('drag-over');
  handleBrandFile(e.dataTransfer.files[0]);
};

function handleBrandFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    brandImage = new Image();
    brandImage.src = ev.target.result;
    brandImage.onload = () => {
      brandControls.classList.remove('hidden');
      brandPreview.src = brandImage.src;
      brandPreview.classList.remove('hidden');
      brandBtn.textContent = 'Change Logo';
    };
  };
  reader.readAsDataURL(file);
}

function showError(msg) {
  uploadError.textContent = msg;
  uploadError.classList.remove('hidden');
}

playBtn.onclick = async () => {
  loadingOverlay.classList.remove('hidden');
  try {
    const source = await setupAudio();
    loadingOverlay.classList.add('hidden');
    source.start(0);
    draw();
    playBtn.disabled = true;
    stopPreviewBtn.disabled = false;
    engineSelect.disabled = true;
    source.onended = stopPreview;
  } catch (err) {
    showError('Error initializing playback: ' + err.message);
    loadingOverlay.classList.add('hidden');
  }
};

stopPreviewBtn.onclick = stopPreview;

function stopPreview() {
  if (audioSource) try { audioSource.stop(); } catch(e) {}
  cancelAnimationFrame(animationId);
  playBtn.disabled = false;
  stopPreviewBtn.disabled = true;
  engineSelect.disabled = false;
}

palettes.forEach(p => {
  p.onclick = () => {
    palettes.forEach(btn => btn.classList.remove('active'));
    p.classList.add('active');
    config.colors = p.dataset.colors.split(',');
    colorCycleToggle.checked = false;
  };
});

cycleToggle.onchange = () => {
  if (cycleToggle.checked) {
    cycleSelection.classList.remove('hidden');
    cycleInterval = setInterval(() => {
      const checkedStyles = Array.from(cycleStyleCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
      
      if (checkedStyles.length > 0) {
        const currentIndex = checkedStyles.indexOf(config.style);
        const nextStyle = checkedStyles[(currentIndex + 1) % checkedStyles.length];
        config.style = nextStyle;
        styleSelect.value = nextStyle;
      }
    }, 5000);
  } else {
    cycleSelection.classList.add('hidden');
    clearInterval(cycleInterval);
  }
};

recordBtn.onclick = async () => {
  loadingOverlay.classList.remove('hidden');
  try {
    const source = await setupAudio();
    const dest = audioContext.createMediaStreamDestination();
    analyser.connect(dest);
    const activeCanvas = config.engine === '2d' ? canvas2d : canvas3d;
    const canvasStream = activeCanvas.captureStream(60);
    const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 12000000 });
    recordedChunks = [];
    mediaRecorder.ondataavailable = (e) => recordedChunks.push(e.data);
    mediaRecorder.onstop = exportVideo;
    loadingOverlay.classList.add('hidden');
    recordingOverlay.style.display = 'flex';
    engineSelect.disabled = true;
    source.start(0);
    mediaRecorder.start();
    draw();
    source.onended = () => {
      mediaRecorder.stop();
      engineSelect.disabled = false;
    };
  } catch (err) {
    showError('Error initializing recording: ' + err.message);
    loadingOverlay.classList.add('hidden');
  }
};

async function exportVideo() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const formData = new FormData();
  formData.append('video', blob);
  statusBadge.textContent = 'Encoding...';
  try {
    const res = await fetch('http://localhost:3001/api/encode', { method: 'POST', body: formData });
    if (res.ok) {
      const result = await res.blob();
      const url = URL.createObjectURL(result);
      const a = document.createElement('a'); a.href = url; a.download = 'ChombieWombie-Visualizer.mp4'; a.click();
    }
  } catch (err) { console.error(err); }
  recordingOverlay.style.display = 'none';
}

init();
