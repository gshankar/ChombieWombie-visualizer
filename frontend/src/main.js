import './style.css'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { VHSShader, GlitchShader, CRTShader } from './shaders.js'
import { STYLES, DEFAULT_CONFIG, FEATURE_FLAGS } from './config.js'

// Global Config & State (Absolute Top)
let config = { ...DEFAULT_CONFIG };
let audioFile = null;
let audioContext = null;
let analyser = null;
let dataArray = null;
let animationId = null;
let audioSource = null;
let brandImage = null;
let hueOffset = 0;
let cycleInterval = null;
let smoothAvg = 0;
let smoothBass = 0;

// Style state
let mystifyPoints = [];
const mystifyCount = 4;
let bouncingCubeState = { pos: new THREE.Vector3(0,0,0), vel: new THREE.Vector3(0.08, 0.06, 0.04) };
let cityBuildings = [];
let originalSpherePos = null;

// Three.js Core
let scene, camera, renderer, composer, canvasTexture, canvasPlane;
let brandingScene, brandingCamera, logoSprite;
let vhsPass, glitchPass, crtPass, bloomPass;
let sphere, terrain, tunnel, stars, bouncingCube, cityContainer;

// Headless Detection
const isHeadless = new URLSearchParams(window.location.search).get('headless') === 'true';

// Helper
const get = (id) => document.getElementById(id);

// --- Core Initialization ---

function init() {
  console.log('ChombieWombie Engine: Initializing UI and Listeners...');
  try {
    // 1. Populate UI Options
    updateStyleOptions();
    updateCycleOptions();
    attachEventListeners();
    console.log('ChombieWombie Engine: UI Ready.');

    // 2. Initialize Rendering Engines
    initThree();
    initStyles();
    resize();
    
    if (isHeadless) {
      document.body.classList.add('headless');
      setupHeadlessAPI();
    }

    if (!FEATURE_FLAGS.enableBranding) {
      const brandingGroup = get('branding-group');
      if (brandingGroup) brandingGroup.style.display = 'none';
    }
    
    const statusBadge = get('status');
    if (statusBadge) statusBadge.textContent = 'Ready';
  } catch (err) {
    console.error('ChombieWombie Engine: Initialization Failed!', err);
  }
}

function updateStyleOptions() { 
  const styleSelect = get('style-select');
  if (!styleSelect || !STYLES[config.engine]) return;
  styleSelect.innerHTML = STYLES[config.engine].map(s => `<option value="${s.id}">${s.name}</option>`).join(''); 
  config.style = STYLES[config.engine][0].id; 
}

function updateCycleOptions() { 
  const cycleStyleList = get('cycle-style-list');
  if (!cycleStyleList || !STYLES[config.engine]) return;
  cycleStyleList.innerHTML = STYLES[config.engine].map(s => `<label><input type="checkbox" class="cycle-style" value="${s.id}" checked> ${s.name}</label>`).join(''); 
}

function attachEventListeners() {
  const engineSelect = get('engine-select');
  const styleSelect = get('style-select');
  const sensitivitySlider = get('sensitivity');
  const dropZone = get('drop-zone');
  const trackBtn = get('track-btn');
  const trackInput = get('track-input');
  const playBtn = get('play-btn');
  const stopPreviewBtn = get('stop-preview-btn');
  const recordBtn = get('record-btn');
  const cycleToggle = get('cycle-toggle');
  const brandBtn = get('brand-btn');
  const brandInput = get('brand-input');
  const brandDropZone = get('brand-drop-zone');

  if (engineSelect) engineSelect.onchange = (e) => { config.engine = e.target.value; updateStyleOptions(); updateCycleOptions(); };
  if (styleSelect) styleSelect.onchange = (e) => config.style = e.target.value;
  if (sensitivitySlider) sensitivitySlider.oninput = (e) => config.sensitivity = e.target.value;

  if (dropZone) {
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); };
    dropZone.ondragleave = () => dropZone.classList.remove('drag-over');
    dropZone.ondrop = (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); handleFile(e.dataTransfer.files[0]); };
  }

  if (trackBtn) trackBtn.onclick = () => trackInput.click();
  if (trackInput) trackInput.onchange = (e) => handleFile(e.target.files[0]);

  if (brandBtn) brandBtn.onclick = () => brandInput.click();
  if (brandInput) brandInput.onchange = (e) => handleBrandFile(e.target.files[0]);

  if (brandDropZone) {
    brandDropZone.ondragover = (e) => { e.preventDefault(); brandDropZone.classList.add('drag-over'); };
    brandDropZone.ondragleave = () => brandDropZone.classList.remove('drag-over');
    brandDropZone.ondrop = (e) => { e.preventDefault(); brandDropZone.classList.remove('drag-over'); handleBrandFile(e.dataTransfer.files[0]); };
  }

  if (playBtn) playBtn.onclick = handlePlay;
  if (stopPreviewBtn) stopPreviewBtn.onclick = stopPreview;
  if (recordBtn) recordBtn.onclick = handleRecord;

  document.querySelectorAll('.palette').forEach(p => {
    p.onclick = () => {
      document.querySelectorAll('.palette').forEach(btn => btn.classList.remove('active'));
      p.classList.add('active'); config.colors = p.dataset.colors.split(','); 
      const colorCycleToggle = get('color-cycle-toggle');
      if (colorCycleToggle) colorCycleToggle.checked = false;
    };
  });

  if (cycleToggle) cycleToggle.onchange = () => {
    const cycleSelection = get('cycle-selection');
    if (cycleToggle.checked) {
      if (cycleSelection) cycleSelection.classList.remove('hidden');
      cycleInterval = setInterval(() => {
        const checkedStyles = Array.from(document.querySelectorAll('.cycle-style')).filter(cb => cb.checked).map(cb => cb.value);
        if (checkedStyles.length > 0) {
          const currentIndex = checkedStyles.indexOf(config.style);
          const nextStyle = checkedStyles[(currentIndex + 1) % checkedStyles.length];
          config.style = nextStyle; 
          if (styleSelect) styleSelect.value = nextStyle;
        }
      }, 60000);
    } else {
      if (cycleSelection) cycleSelection.classList.add('hidden'); 
      clearInterval(cycleInterval);
    }
  };
}

function initThree() {
  const canvas3d = get('visualizer-3d');
  const canvas2d = get('visualizer-2d');
  if (!canvas3d || !canvas2d) throw new Error('Required canvas elements not found');

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, 1, 0.1, 2000);
  camera.position.z = 10;

  brandingScene = new THREE.Scene();
  brandingCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  brandingCamera.position.z = 10;

  renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.autoClear = false;
  renderer.setPixelRatio(window.devicePixelRatio);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  
  vhsPass = new ShaderPass(VHSShader); vhsPass.enabled = false; composer.addPass(vhsPass);
  glitchPass = new ShaderPass(GlitchShader); glitchPass.enabled = false; composer.addPass(glitchPass);
  crtPass = new ShaderPass(CRTShader); crtPass.enabled = false; composer.addPass(crtPass);

  bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
  composer.addPass(bloomPass);

  canvasTexture = new THREE.CanvasTexture(canvas2d);
  canvasPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: canvasTexture, transparent: true }));
  canvasPlane.position.z = 5;
  scene.add(canvasPlane);

  const sphereGeo = new THREE.IcosahedronGeometry(3.5, 32);
  originalSpherePos = sphereGeo.attributes.position.array.slice();
  sphere = new THREE.Mesh(sphereGeo, new THREE.MeshPhongMaterial({ color: config.colors[0], wireframe: true }));
  scene.add(sphere);

  terrain = new THREE.Mesh(new THREE.PlaneGeometry(100, 100, 32, 32), new THREE.MeshPhongMaterial({ color: config.colors[1], wireframe: true, side: THREE.DoubleSide }));
  terrain.rotation.x = -Math.PI / 2; terrain.position.y = -8;
  scene.add(terrain);

  tunnel = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 1000, 32, 1, true), new THREE.MeshPhongMaterial({ color: config.colors[0], wireframe: true, side: THREE.BackSide }));
  tunnel.rotation.x = Math.PI / 2;
  scene.add(tunnel);

  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 3000; i++) starPos.push((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 200);
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.15 }));
  scene.add(stars);

  bouncingCube = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.BoxGeometry(3, 3, 3)), new THREE.LineBasicMaterial({ color: 0xffffff }));
  scene.add(bouncingCube);

  cityContainer = new THREE.Group();
  for (let i = 0; i < 50; i++) {
    const h = Math.random() * 15 + 5;
    const box = new THREE.Mesh(new THREE.BoxGeometry(2, h, 2), new THREE.MeshPhongMaterial({ color: config.colors[0], wireframe: true }));
    box.position.set((Math.random() - 0.5) * 40, h/2 - 10, -Math.random() * 200);
    cityBuildings.push(box); cityContainer.add(box);
  }
  scene.add(cityContainer);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const p = new THREE.PointLight(0xffffff, 1); p.position.set(10, 10, 10); scene.add(p);
}

function initStyles() {
  mystifyPoints = [];
  for (let i = 0; i < mystifyCount; i++) {
    mystifyPoints.push({ x: Math.random() * 1000, y: Math.random() * 1000, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10 });
  }
}

// --- Handlers ---

function handleFile(file) {
  console.log('File received:', file?.name, file?.type);
  const isAudio = file && (file.type.startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a)$/i.test(file.name));
  
  if (isAudio) {
    audioFile = file;
    const trackSlot = get('track-slot');
    const playBtn = get('play-btn');
    const recordBtn = get('record-btn');
    const dropZone = get('drop-zone');
    const statusBadge = get('status');

    if (trackSlot) {
      trackSlot.classList.add('ready');
      const statusText = trackSlot.querySelector('.slot-status');
      if (statusText) statusText.textContent = 'Received';
    }
    if (playBtn) playBtn.disabled = false;
    if (recordBtn) recordBtn.disabled = false;
    
    if (dropZone) {
      const h2 = dropZone.querySelector('h2');
      if (h2) h2.textContent = 'Session Ready';
    }
    if (statusBadge) statusBadge.textContent = 'Armed';
    console.log('Audio file armed:', file.name);
  } else {
    showError('Please upload a valid audio track (MP3, WAV, etc).');
  }
}

async function handlePlay() {
  const dropZone = get('drop-zone');
  const loadingOverlay = get('loading-overlay');
  const playBtn = get('play-btn');
  const stopPreviewBtn = get('stop-preview-btn');

  if (dropZone) dropZone.classList.add('hidden');
  if (loadingOverlay) loadingOverlay.classList.remove('hidden');
  
  try {
    if (audioContext) await audioContext.close();
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser(); analyser.fftSize = 512;
    const audioBuffer = await audioContext.decodeAudioData(await audioFile.arrayBuffer());
    audioSource = audioContext.createBufferSource(); audioSource.buffer = audioBuffer;
    audioSource.connect(analyser); analyser.connect(audioContext.destination);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
    audioSource.start(0); draw();
    
    if (playBtn) playBtn.disabled = true;
    if (stopPreviewBtn) stopPreviewBtn.disabled = false;
    audioSource.onended = stopPreview;
  } catch (err) {
    showError('Playback failed: ' + err.message);
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
  }
}

function stopPreview() {
  if (audioSource) try { audioSource.stop(); } catch(e) {}
  cancelAnimationFrame(animationId);
  const playBtn = get('play-btn');
  const stopPreviewBtn = get('stop-preview-btn');
  const dropZone = get('drop-zone');
  if (playBtn) playBtn.disabled = false;
  if (stopPreviewBtn) stopPreviewBtn.disabled = true;
  if (dropZone) dropZone.classList.remove('hidden');
}

async function handleRecord() {
  const recordingOverlay = get('recording-overlay');
  const renderStatusText = get('render-status-text');
  const renderProgressBar = get('render-progress-bar');
  const renderProgressText = get('render-progress-text');
  const vhsToggle = get('vhs-toggle');
  const crtToggle = get('crt-toggle');
  const glitchToggle = get('glitch-toggle');
  const colorCycleToggle = get('color-cycle-toggle');

  if (recordingOverlay) recordingOverlay.classList.remove('hidden');
  if (renderStatusText) renderStatusText.textContent = 'Preparing...';
  
  try {
    const audioDataMap = await getAudioDataMap();
    const formData = new FormData();
    formData.append('audio', audioFile);
    formData.append('dataMap', JSON.stringify(audioDataMap));
    formData.append('config', JSON.stringify({ 
      ...config, 
      vhs: vhsToggle?.checked, 
      crt: crtToggle?.checked, 
      glitch: glitchToggle?.checked, 
      colorCycle: colorCycleToggle?.checked 
    }));

    const res = await fetch('http://localhost:3001/api/render-headless', { method: 'POST', body: formData });
    if (!res.ok) throw new Error(await res.text());
    const { jobId } = await res.json();
    
    const poll = setInterval(async () => {
      const s = await fetch(`http://localhost:3001/api/render-status/${jobId}`);
      if (s.ok) {
        const { status, progress, error } = await s.json();
        if (status === 'rendering') {
          if (renderProgressBar) renderProgressBar.style.width = `${progress}%`;
          if (renderProgressText) renderProgressText.textContent = `Processing (${progress}%)`;
        } else if (status === 'done') {
          clearInterval(poll);
          window.location.href = `http://localhost:3001/api/render-download/${jobId}`;
          setTimeout(() => { if (recordingOverlay) recordingOverlay.classList.add('hidden'); }, 3000);
        } else if (status === 'error') {
          clearInterval(poll); throw new Error(error);
        }
      }
    }, 1000);
  } catch (err) {
    if (renderStatusText) renderStatusText.textContent = 'Error';
    if (renderProgressText) renderProgressText.textContent = err.message;
    setTimeout(() => { if (recordingOverlay) recordingOverlay.classList.add('hidden'); }, 5000);
  }
}

async function getAudioDataMap() {
  const tCtx = new (window.AudioContext || window.webkitAudioContext)();
  const buffer = await tCtx.decodeAudioData(await audioFile.arrayBuffer());
  const oCtx = new OfflineAudioContext(1, Math.ceil(buffer.duration * 44100), 44100);
  const src = oCtx.createBufferSource(); src.buffer = buffer;
  const ans = oCtx.createAnalyser(); ans.fftSize = 512;
  src.connect(ans); ans.connect(oCtx.destination);
  const fps = 60; const total = Math.ceil(buffer.duration * fps); const map = [];
  src.start(0);
  for (let i = 0; i < total; i++) {
    await oCtx.suspend(i / fps);
    const data = new Uint8Array(ans.frequencyBinCount); ans.getByteFrequencyData(data);
    map.push(Array.from(data)); oCtx.resume();
  }
  return map;
}

// --- Rendering ---

function draw() {
  animationId = requestAnimationFrame(draw);
  const time = performance.now() * 0.001;
  const canvas2d = get('visualizer-2d');
  const ctx2d = canvas2d?.getContext('2d');
  if (!analyser || !ctx2d) return;

  analyser.getByteFrequencyData(dataArray);
  const avg = dataArray.reduce((a,b) => a+b) / dataArray.length;
  const bass = dataArray.slice(0, 10).reduce((a,b) => a+b) / 10;
  smoothAvg += (avg - smoothAvg) * 0.15; smoothBass += (bass - smoothBass) * 0.15;
  
  const colorCycleToggle = get('color-cycle-toggle');
  if (colorCycleToggle?.checked) { 
    hueOffset = (hueOffset + 0.5) % 360; 
    config.colors = [`hsl(${hueOffset}, 100%, 50%)`, `hsl(${(hueOffset + 60) % 360}, 100%, 50%)` ]; 
  }
  
  draw2D(ctx2d, canvas2d); 
  renderUnified(time);
}

function draw2D(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (config.engine !== '2d') return;
  
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width;
  const h = canvas.height;
  const r = Math.min(w, h) / 4;
  
  ctx.strokeStyle = config.colors[0]; 
  ctx.lineWidth = 4 * dpr;
  ctx.lineCap = 'round';

  if (config.style.startsWith('circular')) {
    for (let i = 0; i < dataArray.length; i++) {
      const barHeight = (dataArray[i]/255) * r * (config.sensitivity/5); 
      const angle = (i/dataArray.length) * Math.PI * 2;
      const x1 = w/2 + Math.cos(angle) * r;
      const y1 = h/2 + Math.sin(angle) * r;
      const x2 = w/2 + Math.cos(angle) * (r + barHeight);
      const y2 = h/2 + Math.sin(angle) * (r + barHeight);
      
      ctx.beginPath(); 
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2); 
      ctx.stroke();
    }
  } else if (config.style === 'sunrise') {
    const sunriseY = h / 2;
    ctx.beginPath(); 
    ctx.moveTo(0, sunriseY); 
    ctx.lineTo(w, sunriseY); 
    ctx.stroke();
  }
}

function renderUnified(time) {
  const intensity = (smoothAvg/255)*config.sensitivity;
  const is3D = config.engine === '3d';
  if (sphere) sphere.visible = is3D && config.style === '3d-sphere';
  if (terrain) terrain.visible = is3D && config.style === '3d-terrain';
  if (tunnel) tunnel.visible = is3D && config.style === '3d-tunnel';
  if (stars) stars.visible = is3D && config.style === '3d-stars';
  if (bouncingCube) bouncingCube.visible = is3D && config.style === '3d-cube';
  if (cityContainer) cityContainer.visible = is3D && config.style === '3d-city';
  if (canvasPlane) {
    canvasPlane.visible = !is3D;
    if (canvasPlane.visible && canvasTexture) { canvasTexture.needsUpdate = true; canvasPlane.scale.set(camera.aspect * 15, 15, 1); }
  }
  if (is3D && camera) { camera.position.set(Math.sin(time*0.5)*15, 0, Math.cos(time*0.5)*15); camera.lookAt(0,0,0); }
  if (sphere?.visible) { sphere.rotation.y += 0.01; sphere.material.color.set(config.colors[0]); }
  
  const vhsToggle = get('vhs-toggle');
  const crtToggle = get('crt-toggle');
  const glitchToggle = get('glitch-toggle');
  if (vhsPass) vhsPass.enabled = vhsToggle?.checked;
  if (crtPass) crtPass.enabled = crtToggle?.checked;
  if (glitchPass) glitchPass.enabled = glitchToggle?.checked;
  if (bloomPass) bloomPass.strength = 1.2 + (smoothBass/255)*0.8;
  
  if (renderer && composer) { renderer.clear(); composer.render(); }
}

function resize() {
  const canvas3d = get('visualizer-3d');
  const canvas2d = get('visualizer-2d');
  if (!canvas3d || !canvas2d || !canvas3d.parentElement) return;
  
  const w = canvas3d.parentElement.offsetWidth; 
  const h = canvas3d.parentElement.offsetHeight;
  const dpr = window.devicePixelRatio || 1;

  if (renderer) {
    renderer.setSize(w, h);
    renderer.setPixelRatio(dpr);
  }
  if (composer) composer.setSize(w, h);
  if (camera) { camera.aspect = w/h; camera.updateProjectionMatrix(); }
  
  canvas2d.width = w * dpr; 
  canvas2d.height = h * dpr;
}

function showError(m) { 
  const uploadError = get('upload-error');
  if (uploadError) { uploadError.textContent = m; uploadError.classList.remove('hidden'); }
}

function setupHeadlessAPI() { 
  const canvas3d = get('visualizer-3d');
  window.renderFrame = async (idx, data, cfg, time) => { 
    config = { ...config, ...cfg }; 
    dataArray = new Uint8Array(data); 
    const canvas2d = get('visualizer-2d');
    const ctx2d = canvas2d?.getContext('2d');
    draw2D(ctx2d, canvas2d); 
    renderUnified(time); 
    return canvas3d.toDataURL(); 
  }; 
}

// Start Engine
init();
