import './style.css'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { VHSShader, GlitchShader, CRTShader } from './shaders.js'
import { STYLES, DEFAULT_CONFIG, FEATURE_FLAGS } from './config.js'

// State management
let audioContext, analyser, dataArray, animationId, audioFile, audioSource;
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

// DOM Elements
const isHeadless = new URLSearchParams(window.location.search).get('headless') === 'true';
const canvas2d = document.getElementById('visualizer-2d'); 
const ctx2d = canvas2d.getContext('2d');
const canvas3d = document.getElementById('visualizer-3d');
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
const sensitivitySlider = document.getElementById('sensitivity');
const colorCycleToggle = document.getElementById('color-cycle-toggle');
const cycleToggle = document.getElementById('cycle-toggle');
const cycleSelection = document.getElementById('cycle-selection');
const cycleStyleList = document.getElementById('cycle-style-list');
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
const renderProgressBar = document.getElementById('render-progress-bar');
const renderProgressText = document.getElementById('render-progress-text');
const renderStatusText = document.getElementById('render-status-text');
const recordingOverlay = document.getElementById('recording-overlay');

// Config
let config = { ...DEFAULT_CONFIG };

// --- Initialization ---

function init() {
  console.log('ChombieWombie Engine Initializing...');
  updateStyleOptions();
  updateCycleOptions();
  initThree();
  initStyles();
  attachEventListeners();
  resize();
  
  if (isHeadless) {
    document.body.classList.add('headless');
    setupHeadlessAPI();
  }

  if (!FEATURE_FLAGS.enableBranding) {
    const brandingGroup = document.getElementById('branding-group');
    if (brandingGroup) brandingGroup.style.display = 'none';
  }
  
  statusBadge.textContent = 'Ready';
}

function attachEventListeners() {
  engineSelect.onchange = (e) => {
    config.engine = e.target.value;
    updateStyleOptions(); updateCycleOptions();
  };

  styleSelect.onchange = (e) => config.style = e.target.value;
  sensitivitySlider.oninput = (e) => config.sensitivity = e.target.value;

  dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); };
  dropZone.ondragleave = () => dropZone.classList.remove('drag-over');
  dropZone.ondrop = (e) => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    handleFile(e.dataTransfer.files[0]);
  };

  trackBtn.onclick = () => trackInput.click();
  trackInput.onchange = (e) => handleFile(e.target.files[0]);

  brandBtn.onclick = () => brandInput.click();
  brandInput.onchange = (e) => handleBrandFile(e.target.files[0]);

  brandDropZone.ondragover = (e) => { e.preventDefault(); brandDropZone.classList.add('drag-over'); };
  brandDropZone.ondragleave = () => brandDropZone.classList.remove('drag-over');
  brandDropZone.ondrop = (e) => {
    e.preventDefault(); brandDropZone.classList.remove('drag-over');
    handleBrandFile(e.dataTransfer.files[0]);
  };

  playBtn.onclick = handlePlay;
  stopPreviewBtn.onclick = stopPreview;
  recordBtn.onclick = handleRecord;

  document.querySelectorAll('.palette').forEach(p => {
    p.onclick = () => {
      document.querySelectorAll('.palette').forEach(btn => btn.classList.remove('active'));
      p.classList.add('active'); config.colors = p.dataset.colors.split(','); colorCycleToggle.checked = false;
    };
  });

  cycleToggle.onchange = () => {
    if (cycleToggle.checked) {
      cycleSelection.classList.remove('hidden');
      cycleInterval = setInterval(() => {
        const checkedStyles = Array.from(document.querySelectorAll('.cycle-style')).filter(cb => cb.checked).map(cb => cb.value);
        if (checkedStyles.length > 0) {
          const currentIndex = checkedStyles.indexOf(config.style);
          const nextStyle = checkedStyles[(currentIndex + 1) % checkedStyles.length];
          config.style = nextStyle; styleSelect.value = nextStyle;
        }
      }, 60000);
    } else {
      cycleSelection.classList.add('hidden'); clearInterval(cycleInterval);
    }
  };
}

function initThree() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, 1, 0.1, 2000);
  camera.position.z = 10;

  brandingScene = new THREE.Scene();
  brandingCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  brandingCamera.position.z = 10;

  renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.autoClear = false;

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

// --- Logic ---

function handleFile(file) {
  if (file && file.type.startsWith('audio/')) {
    audioFile = file;
    trackSlot.classList.add('ready');
    trackSlot.querySelector('.slot-status').textContent = 'Received';
    playBtn.disabled = false; recordBtn.disabled = false;
    dropZone.querySelector('h2').textContent = 'Session Ready';
    statusBadge.textContent = 'Armed';
  } else {
    showError('Please upload a valid audio track.');
  }
}

async function handlePlay() {
  dropZone.classList.add('hidden'); loadingOverlay.classList.remove('hidden');
  try {
    if (audioContext) await audioContext.close();
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser(); analyser.fftSize = 512;
    const audioBuffer = await audioContext.decodeAudioData(await audioFile.arrayBuffer());
    audioSource = audioContext.createBufferSource(); audioSource.buffer = audioBuffer;
    audioSource.connect(analyser); analyser.connect(audioContext.destination);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    loadingOverlay.classList.add('hidden'); audioSource.start(0); draw();
    playBtn.disabled = true; stopPreviewBtn.disabled = false;
    audioSource.onended = stopPreview;
  } catch (err) {
    showError('Playback failed: ' + err.message); loadingOverlay.classList.add('hidden');
  }
}

function stopPreview() {
  if (audioSource) try { audioSource.stop(); } catch(e) {}
  cancelAnimationFrame(animationId);
  playBtn.disabled = false; stopPreviewBtn.disabled = true;
  dropZone.classList.remove('hidden');
}

async function handleRecord() {
  recordingOverlay.classList.remove('hidden');
  renderStatusText.textContent = 'Preparing...';
  try {
    const audioDataMap = await getAudioDataMap();
    const formData = new FormData();
    formData.append('audio', audioFile);
    formData.append('dataMap', JSON.stringify(audioDataMap));
    formData.append('config', JSON.stringify({ ...config, vhs: vhsToggle.checked, crt: crtToggle.checked, glitch: glitchToggle.checked, colorCycle: colorCycleToggle.checked }));
    const res = await fetch('http://localhost:3001/api/render-headless', { method: 'POST', body: formData });
    if (!res.ok) throw new Error(await res.text());
    const { jobId } = await res.json();
    const poll = setInterval(async () => {
      const s = await fetch(`http://localhost:3001/api/render-status/${jobId}`);
      if (s.ok) {
        const { status, progress, error } = await s.json();
        if (status === 'rendering') {
          renderProgressBar.style.width = `${progress}%`;
          renderProgressText.textContent = `Processing (${progress}%)`;
        } else if (status === 'done') {
          clearInterval(poll); window.location.href = `http://localhost:3001/api/render-download/${jobId}`;
          setTimeout(() => recordingOverlay.classList.add('hidden'), 3000);
        } else if (status === 'error') {
          clearInterval(poll); throw new Error(error);
        }
      }
    }, 1000);
  } catch (err) {
    renderStatusText.textContent = 'Error'; renderProgressText.textContent = err.message;
    setTimeout(() => recordingOverlay.classList.add('hidden'), 5000);
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

function draw() {
  animationId = requestAnimationFrame(draw);
  const time = performance.now() * 0.001;
  analyser.getByteFrequencyData(dataArray);
  const avg = dataArray.reduce((a,b) => a+b) / dataArray.length;
  const bass = dataArray.slice(0, 10).reduce((a,b) => a+b) / 10;
  smoothAvg += (avg - smoothAvg) * 0.15; smoothBass += (bass - smoothBass) * 0.15;
  if (colorCycleToggle.checked) { hueOffset = (hueOffset + 0.5) % 360; config.colors = [`hsl(${hueOffset}, 100%, 50%)`, `hsl(${(hueOffset + 60) % 360}, 100%, 50%)` ]; }
  draw2D(); renderUnified(time);
}

function draw2D() {
  ctx2d.clearRect(0,0,canvas2d.width,canvas2d.height);
  if (config.engine !== '2d') return;
  const r = Math.min(canvas2d.width, canvas2d.height) / 4;
  ctx2d.strokeStyle = config.colors[0]; ctx2d.lineWidth = 4;
  if (config.style.startsWith('circular')) {
    for (let i = 0; i < dataArray.length; i++) {
      const h = (dataArray[i]/255) * r * (config.sensitivity/5); const a = (i/dataArray.length)*Math.PI*2;
      ctx2d.beginPath(); ctx2d.moveTo(canvas2d.width/2 + Math.cos(a)*r, canvas2d.height/2 + Math.sin(a)*r);
      ctx2d.lineTo(canvas2d.width/2 + Math.cos(a)*(r+h), canvas2d.height/2 + Math.sin(a)*(r+h)); ctx2d.stroke();
    }
  } else if (config.style === 'sunrise') {
    ctx2d.beginPath(); ctx2d.moveTo(0, canvas2d.height/2); ctx2d.lineTo(canvas2d.width, canvas2d.height/2); ctx2d.stroke();
  }
}

function renderUnified(time) {
  const intensity = (smoothAvg/255)*config.sensitivity;
  const is3D = config.engine === '3d';
  sphere.visible = is3D && config.style === '3d-sphere';
  terrain.visible = is3D && config.style === '3d-terrain';
  tunnel.visible = is3D && config.style === '3d-tunnel';
  stars.visible = is3D && config.style === '3d-stars';
  bouncingCube.visible = is3D && config.style === '3d-cube';
  cityContainer.visible = is3D && config.style === '3d-city';
  canvasPlane.visible = !is3D;
  if (canvasPlane.visible) { canvasTexture.needsUpdate = true; canvasPlane.scale.set(camera.aspect * 15, 15, 1); }
  if (is3D) { camera.position.set(Math.sin(time*0.5)*15, 0, Math.cos(time*0.5)*15); camera.lookAt(0,0,0); }
  if (sphere.visible) { sphere.rotation.y += 0.01; sphere.material.color.set(config.colors[0]); }
  vhsPass.enabled = vhsToggle.checked; crtPass.enabled = crtToggle.checked; glitchPass.enabled = glitchToggle.checked;
  bloomPass.strength = 1.2 + (smoothBass/255)*0.8;
  renderer.clear(); composer.render();
}

function resize() {
  const w = canvas3d.parentElement.offsetWidth; const h = canvas3d.parentElement.offsetHeight;
  renderer.setSize(w, h); camera.aspect = w/h; camera.updateProjectionMatrix();
  canvas2d.width = w; canvas2d.height = h;
}

function updateStyleOptions() { styleSelect.innerHTML = STYLES[config.engine].map(s => `<option value="${s.id}">${s.name}</option>`).join(''); config.style = STYLES[config.engine][0].id; }
function updateCycleOptions() { cycleStyleList.innerHTML = STYLES[config.engine].map(s => `<label><input type="checkbox" class="cycle-style" value="${s.id}" checked> ${s.name}</label>`).join(''); }
function showError(m) { uploadError.textContent = m; uploadError.classList.remove('hidden'); }
function setupHeadlessAPI() { window.renderFrame = async (idx, data, cfg, time) => { config = { ...config, ...cfg }; dataArray = new Uint8Array(data); draw2D(); renderUnified(time); return canvas3d.toDataURL(); }; }

init();
