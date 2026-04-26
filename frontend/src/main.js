import './style.css'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { VHSShader, GlitchShader, CRTShader } from './shaders.js'
import { STYLES, DEFAULT_CONFIG, FEATURE_FLAGS } from './config.js'

// State management
let audioContext, analyser, source, dataArray, animationId, mediaRecorder;
let recordedChunks = [];
let audioFile, audioSource;
let brandImage = null;
let hueOffset = 0;
let cycleInterval = null;

// Audio Reactivity Smoothing
let smoothAvg = 0;
let smoothBass = 0;

// Style-specific state
let mystifyPoints = [];
const mystifyCount = 4;
let bouncingCubeState = { pos: new THREE.Vector3(0,0,0), vel: new THREE.Vector3(0.08, 0.06, 0.04) };
let cityBuildings = [];
let originalSpherePos = null;

// Unified Rendering Pipeline
const canvas2d = document.getElementById('visualizer-2d'); 
const ctx2d = canvas2d.getContext('2d');
const canvas3d = document.getElementById('visualizer-3d');

let scene, camera, renderer, composer;
let brandingScene, brandingCamera; 
let vhsPass, glitchPass, crtPass, bloomPass;
let sphere, terrain, tunnel, stars, bouncingCube, cityContainer, logoSprite;
let canvasPlane, canvasTexture;

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

// Config
let config = { ...DEFAULT_CONFIG };

// --- Initialization ---

function init() {
  updateStyleOptions();
  updateCycleOptions();
  initThree();
  initStyles();
  resize();
  
  if (!FEATURE_FLAGS.enableBranding) {
    const brandingGroup = document.getElementById('branding-group') || document.querySelector('.control-group:last-child');
    if (brandingGroup) brandingGroup.style.display = 'none';
  }
}

function initStyles() {
  mystifyPoints = [];
  for (let i = 0; i < mystifyCount; i++) {
    mystifyPoints.push({
      x: Math.random() * 1000,
      y: Math.random() * 1000,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10
    });
  }
}

function updateStyleOptions() {
  styleSelect.innerHTML = STYLES[config.engine].map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  config.style = STYLES[config.engine][0].id;
}

function updateCycleOptions() {
  cycleStyleList.innerHTML = STYLES[config.engine].map(s => `
    <label><input type="checkbox" class="cycle-style" value="${s.id}" checked> ${s.name}</label>
  `).join('');
}

function resize() {
  const container = canvas3d.parentElement;
  const width = container.offsetWidth;
  const height = container.offsetHeight;

  canvas2d.width = width * window.devicePixelRatio;
  canvas2d.height = height * window.devicePixelRatio;
  
  if (renderer) {
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    brandingCamera.left = -width / 2;
    brandingCamera.right = width / 2;
    brandingCamera.top = height / 2;
    brandingCamera.bottom = -height / 2;
    brandingCamera.updateProjectionMatrix();
    if (composer) composer.setSize(width, height);
    if (logoSprite) updateLogoPosition3D();
  }
}
window.addEventListener('resize', resize);

function initThree() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, 1, 0.1, 2000);
  camera.position.z = 10;

  brandingScene = new THREE.Scene();
  brandingCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  brandingCamera.position.z = 10;

  renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true, alpha: true });
  renderer.autoClear = false;

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  
  // VHS/CRT/Glitch passes FIRST
  vhsPass = new ShaderPass(VHSShader); vhsPass.enabled = false; composer.addPass(vhsPass);
  glitchPass = new ShaderPass(GlitchShader); glitchPass.enabled = false; composer.addPass(glitchPass);
  crtPass = new ShaderPass(CRTShader); crtPass.enabled = false; composer.addPass(crtPass);

  // Bloom LAST to catch the scanlines and brightened pixels
  bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
  composer.addPass(bloomPass);

  canvasTexture = new THREE.CanvasTexture(canvas2d);
  const planeGeo = new THREE.PlaneGeometry(1, 1);
  const planeMat = new THREE.MeshBasicMaterial({ map: canvasTexture, transparent: true });
  canvasPlane = new THREE.Mesh(planeGeo, planeMat);
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
  for (let i = 0; i < 3000; i++) {
    starPos.push((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 200);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.15 }));
  scene.add(stars);

  const cubeGeo = new THREE.BoxGeometry(3, 3, 3);
  const cubeWire = new THREE.WireframeGeometry(cubeGeo);
  bouncingCube = new THREE.LineSegments(cubeWire, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }));
  scene.add(bouncingCube);

  cityContainer = new THREE.Group();
  for (let i = 0; i < 50; i++) {
    const h = Math.random() * 15 + 5;
    const box = new THREE.Mesh(new THREE.BoxGeometry(2, h, 2), new THREE.MeshPhongMaterial({ color: config.colors[0], wireframe: true }));
    box.position.set((Math.random() - 0.5) * 40, h/2 - 10, -Math.random() * 200);
    cityBuildings.push(box);
    cityContainer.add(box);
  }
  scene.add(cityContainer);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const p = new THREE.PointLight(0xffffff, 1); p.position.set(10, 10, 10); scene.add(p);
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
  if (analyser) {
    analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const bassRange = dataArray.slice(0, 10);
    const bass = bassRange.reduce((a, b) => a + b) / bassRange.length;
    smoothAvg += (avg - smoothAvg) * 0.15;
    smoothBass += (bass - smoothBass) * 0.15;
  }

  if (colorCycleToggle.checked) {
    hueOffset = (hueOffset + 0.5) % 360;
    config.colors = [`hsl(${hueOffset}, 100%, 50%)`, `hsl(${(hueOffset + 60) % 360}, 100%, 50%)` ];
  }

  draw2D();
  renderUnified();
}

function draw2D() {
  const w = canvas2d.width; const h = canvas2d.height;
  const time = performance.now() * 0.001;
  ctx2d.clearRect(0, 0, w, h);
  if (config.engine !== '2d') return; 

  const bars = dataArray.length; const cx = w / 2; const cy = h / 2; const r = Math.min(w, h) / 4; const sens = config.sensitivity;
  ctx2d.strokeStyle = config.colors[0]; ctx2d.lineWidth = 4 * window.devicePixelRatio; ctx2d.lineCap = 'round';

  const intensity = (smoothAvg / 255) * config.sensitivity;

  if (config.style.startsWith('circular')) {
    for (let i = 0; i < bars; i++) {
      const barHeight = (dataArray[i] / 255) * r * (sens / 5); const angle = (i / bars) * Math.PI * 2; let x1, y1, x2, y2;
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
  } else if (config.style === 'sunrise') {
    const sunriseY = h / 2; const sunriseR = r * 1.8;
    for (let i = 0; i < bars; i++) {
      const barHeight = (dataArray[i] / 255) * r * (sens / 5); const angle = Math.PI + (i / bars) * Math.PI;
      const x1 = cx + Math.cos(angle) * (sunriseR - barHeight/2); const y1 = sunriseY + Math.sin(angle) * (sunriseR - barHeight/2);
      const x2 = cx + Math.cos(angle) * (sunriseR + barHeight/2); const y2 = sunriseY + Math.sin(angle) * (sunriseR + barHeight/2);
      ctx2d.beginPath(); ctx2d.moveTo(x1, y1); ctx2d.lineTo(x2, y2); ctx2d.stroke();
    }
    ctx2d.beginPath(); ctx2d.moveTo(0, sunriseY); ctx2d.lineTo(w, sunriseY); ctx2d.stroke();
  } else if (config.style === 'mystify') {
    const points = mystifyPoints;
    const speed = 1 + intensity;
    for (let i = 0; i < points.length; i++) {
      let p = points[i];
      p.x += p.vx * speed; p.y += p.vy * speed;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
    }
    ctx2d.beginPath();
    ctx2d.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx2d.lineTo(points[i].x, points[i].y);
    ctx2d.closePath(); ctx2d.stroke();
  } else if (config.style === 'plasma') {
    const boxSize = 25 + Math.sin(time * 2) * 10;
    for (let x = 0; x < w; x += boxSize) {
      for (let y = 0; y < h; y += boxSize) {
        const v = Math.sin(x/50 + time) + Math.sin(y/50 + time) + Math.sin((x+y)/50 + time);
        const hue = (v * 50 + hueOffset) % 360;
        ctx2d.fillStyle = `hsla(${hue}, 100%, 50%, 0.3)`;
        ctx2d.fillRect(x, y, boxSize, boxSize);
      }
    }
  } else if (config.style === 'bars') {
    const barWidth = (w / bars) * 2;
    for (let i = 0; i < bars; i++) {
      const barHeight = (dataArray[i] / 255) * h * 0.5 * (sens / 5);
      ctx2d.fillStyle = config.colors[0]; ctx2d.fillRect(i * (barWidth + 1), h - barHeight, barWidth, barHeight);
    }
  }
}

function renderUnified() {
  const time = performance.now() * 0.001;
  const intensity = (smoothAvg / 255) * config.sensitivity;
  const bassIntensity = (smoothBass / 255) * config.sensitivity;

  const is3D = config.engine === '3d';
  sphere.visible = is3D && config.style === '3d-sphere';
  terrain.visible = is3D && config.style === '3d-terrain';
  tunnel.visible = is3D && config.style === '3d-tunnel';
  stars.visible = is3D && config.style === '3d-stars';
  bouncingCube.visible = is3D && config.style === '3d-cube';
  cityContainer.visible = is3D && config.style === '3d-city';
  canvasPlane.visible = !is3D;

  if (canvasPlane.visible) {
    canvasTexture.needsUpdate = true;
    const distance = Math.abs(camera.position.z - canvasPlane.position.z);
    const vFov = (camera.fov * Math.PI) / 180;
    const h = 2 * Math.tan(vFov / 2) * distance;
    canvasPlane.scale.set(h * camera.aspect, h, 1);
  }

  if (is3D) {
    if (config.style === '3d-sphere' || config.style === '3d-cube') {
      camera.position.x = Math.sin(time * 0.5) * 15;
      camera.position.z = Math.cos(time * 0.5) * 15;
      camera.lookAt(0, 0, 0);
    } else if (config.style === '3d-terrain' || config.style === '3d-city') {
      camera.position.y = -2 + bassIntensity;
      camera.position.z = 15;
      camera.lookAt(0, 0, -20);
    } else if (config.style === '3d-tunnel') {
      camera.position.z = 10;
      camera.position.x = Math.sin(time * 2) * (2 + intensity);
      camera.position.y = Math.cos(time * 2) * (2 + intensity);
      camera.lookAt(0, 0, -50);
    } else {
      camera.position.set(0, 0, 15);
      camera.lookAt(0, 0, 0);
    }
  }

  if (sphere.visible) {
    const pos = sphere.geometry.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      const ix = originalSpherePos[i]; const iy = originalSpherePos[i+1]; const iz = originalSpherePos[i+2];
      const distortion = Math.sin(time * 2 + ix * 0.5) * intensity * 0.8;
      pos[i] = ix + distortion; pos[i+1] = iy + distortion; pos[i+2] = iz + distortion;
    }
    sphere.geometry.attributes.position.needsUpdate = true;
    sphere.rotation.y += 0.01; sphere.material.color.set(config.colors[0]);
  }
  if (terrain.visible) {
    const pos = terrain.geometry.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i]; const y = pos[i+1]; const dist = Math.sqrt(x*x + y*y);
      pos[i+2] = Math.sin(dist * 0.2 - time * 2) * intensity * 5;
    }
    terrain.geometry.attributes.position.needsUpdate = true;
    terrain.material.color.set(config.colors[1]);
  }
  if (tunnel.visible) {
    tunnel.rotation.z += 0.01; 
    const s = 1 + intensity * 0.05; tunnel.scale.set(s, s, 1);
    tunnel.material.color.set(config.colors[0]);
  }
  if (stars.visible) {
    const pos = stars.geometry.attributes.position.array;
    const speed = 0.1 + intensity * 0.4;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i+2] += speed;
      if (pos[i+2] > 100) pos[i+2] = -100;
    }
    stars.geometry.attributes.position.needsUpdate = true;
    stars.material.color.set(config.colors[0]);
    stars.material.size = 0.1 + intensity * 0.1;
  }

  if (bouncingCube.visible) {
    const speed = 0.5 + intensity;
    bouncingCubeState.pos.add(bouncingCubeState.vel.clone().multiplyScalar(speed));
    if (Math.abs(bouncingCubeState.pos.x) > 8) bouncingCubeState.vel.x *= -1;
    if (Math.abs(bouncingCubeState.pos.y) > 5) bouncingCubeState.vel.y *= -1;
    if (Math.abs(bouncingCubeState.pos.z) > 4) bouncingCubeState.vel.z *= -1;
    bouncingCube.position.copy(bouncingCubeState.pos);
    bouncingCube.rotation.x += 0.02; bouncingCube.rotation.y += 0.02;
    const s = 1 + bassIntensity * 0.3; bouncingCube.scale.set(s,s,s);
    bouncingCube.material.color.set(config.colors[0]);
  }

  if (cityContainer.visible) {
    const speed = 0.2 + intensity * 0.4; 
    cityBuildings.forEach(b => {
      b.position.z += speed;
      if (b.position.z > 20) b.position.z = -200;
      b.scale.y = 1 + bassIntensity * 0.8; 
      b.material.color.set(config.colors[0]);
    });
  }

  const filtersEnabled = vhsToggle.checked || crtToggle.checked || glitchToggle.checked;
  const brightnessBoost = 1.0;

  if (vhsPass) { 
    vhsPass.enabled = vhsToggle.checked; 
    vhsPass.uniforms.time.value = time; 
    vhsPass.uniforms.amount.value = 0.5 + intensity * 0.2; 
    vhsPass.uniforms.brightness.value = brightnessBoost;
  }
  if (crtPass) { 
    crtPass.enabled = crtToggle.checked; 
    crtPass.uniforms.time.value = time; 
    crtPass.uniforms.brightness.value = brightnessBoost;
  }
  if (glitchPass) { 
    glitchPass.enabled = glitchToggle.checked || (smoothBass > 220); 
    glitchPass.uniforms.time.value = time; 
    glitchPass.uniforms.brightness.value = brightnessBoost;
  }

  if (bloomPass) {
    bloomPass.strength = 1.2 + bassIntensity * 0.8;
  }

  renderer.clear();
  composer.render();

  if (FEATURE_FLAGS.enableBranding && logoSprite && brandImage) {
    logoSprite.visible = true;
    updateLogoPosition3D();
    renderer.render(brandingScene, brandingCamera);
  }
}

function updateLogoPosition3D() {
  if (!logoSprite || !brandImage) return;
  const logoAspect = brandImage.width / brandImage.height;
  const width = canvas3d.width / window.devicePixelRatio;
  const height = canvas3d.height / window.devicePixelRatio;
  const baseScale = (brandScale.value / 100) * (height * 0.3);
  logoSprite.scale.set(baseScale * logoAspect, baseScale, 1);
  const hLimit = width / 2; const vLimit = height / 2; const padding = baseScale * 0.5 + 40;
  switch(brandPos.value) {
    case 'top-right': logoSprite.position.set(hLimit - padding, vLimit - padding, 0); break;
    case 'top-left': logoSprite.position.set(-hLimit + padding, vLimit - padding, 0); break;
    case 'bottom-right': logoSprite.position.set(hLimit - padding, -vLimit + padding, 0); break;
    case 'bottom-left': logoSprite.position.set(-hLimit + padding, -vLimit + padding, 0); break;
    case 'center': logoSprite.position.set(0, 0, 0); break;
  }
}

// --- Handlers ---

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

function handleFile(file) {
  if (file && file.type.startsWith('audio/')) {
    audioFile = file;
    trackSlot.classList.add('ready');
    trackSlot.querySelector('.slot-status').textContent = 'Received';
    playBtn.disabled = false;
    recordBtn.disabled = false;
    dropZone.querySelector('h2').textContent = 'Session Ready';
    dropZone.querySelector('p').textContent = 'Hit Play or Record in the sidebar to begin.';
    statusBadge.textContent = 'Session Armed';
  } else {
    showError('Please upload a valid audio track to begin.');
  }
}

brandBtn.onclick = () => brandInput.click();
brandInput.onchange = (e) => handleBrandFile(e.target.files[0]);

brandDropZone.ondragover = (e) => { e.preventDefault(); brandDropZone.classList.add('drag-over'); };
brandDropZone.ondragleave = () => brandDropZone.classList.remove('drag-over');
brandDropZone.ondrop = (e) => {
  e.preventDefault(); brandDropZone.classList.remove('drag-over');
  handleBrandFile(e.dataTransfer.files[0]);
};

function handleBrandFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    brandImage = new Image(); brandImage.src = ev.target.result;
    brandImage.onload = () => {
      brandControls.classList.remove('hidden'); brandPreview.src = brandImage.src;
      brandPreview.classList.remove('hidden'); brandBtn.textContent = 'Change Logo';
      const texture = new THREE.TextureLoader().load(brandImage.src);
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
      if (logoSprite) brandingScene.remove(logoSprite);
      logoSprite = new THREE.Sprite(material); brandingScene.add(logoSprite); updateLogoPosition3D();
    };
  };
  reader.readAsDataURL(file);
}

function showError(msg) {
  uploadError.textContent = msg; uploadError.classList.remove('hidden');
}

playBtn.onclick = async () => {
  dropZone.classList.add('hidden');
  loadingOverlay.classList.remove('hidden');
  try {
    const source = await setupAudio();
    loadingOverlay.classList.add('hidden'); source.start(0); draw();
    playBtn.disabled = true; stopPreviewBtn.disabled = false; engineSelect.disabled = true;
    source.onended = stopPreview;
    statusBadge.textContent = 'Playing';
  } catch (err) {
    showError('Error initializing playback: ' + err.message); loadingOverlay.classList.add('hidden');
  }
};

stopPreviewBtn.onclick = stopPreview;

function stopPreview() {
  if (audioSource) try { audioSource.stop(); } catch(e) {}
  cancelAnimationFrame(animationId);
  playBtn.disabled = false; stopPreviewBtn.disabled = true; engineSelect.disabled = false;
  statusBadge.textContent = 'Stopped';
  dropZone.classList.remove('hidden'); 
}

palettes.forEach(p => {
  p.onclick = () => {
    palettes.forEach(btn => btn.classList.remove('active'));
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

recordBtn.onclick = async () => {
  dropZone.classList.add('hidden');
  loadingOverlay.classList.remove('hidden');
  try {
    const source = await setupAudio();
    const dest = audioContext.createMediaStreamDestination(); analyser.connect(dest);
    const canvasStream = canvas3d.captureStream(60);
    const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 12000000 });
    recordedChunks = []; mediaRecorder.ondataavailable = (e) => recordedChunks.push(e.data);
    mediaRecorder.onstop = exportVideo;
    loadingOverlay.classList.add('hidden'); recordingOverlay.style.display = 'flex';
    engineSelect.disabled = true; source.start(0); mediaRecorder.start(); draw();
    source.onended = () => { mediaRecorder.stop(); engineSelect.disabled = false; };
    statusBadge.textContent = 'Recording';
  } catch (err) {
    showError('Error initializing recording: ' + err.message); loadingOverlay.classList.add('hidden');
  }
};

async function exportVideo() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const formData = new FormData(); formData.append('video', blob);
  statusBadge.textContent = 'Encoding...';
  try {
    const res = await fetch('http://localhost:3001/api/encode', { method: 'POST', body: formData });
    if (res.ok) {
      const result = await res.blob(); const url = URL.createObjectURL(result);
      const a = document.createElement('a'); a.href = url; a.download = 'ChombieWombie-Visualizer.mp4'; a.click();
    }
  } catch (err) { console.error(err); }
  recordingOverlay.style.display = 'none';
  statusBadge.textContent = 'Exported';
  dropZone.classList.remove('hidden');
}

init();
