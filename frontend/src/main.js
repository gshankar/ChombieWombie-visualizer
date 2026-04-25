import './style.css'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { VHSShader, GlitchShader, CRTShader } from './shaders.js'

// State management
let audioContext, analyser, source, dataArray, animationId, mediaRecorder;
let recordedChunks = [];
let audioFile, audioSource;
let isRecording = false;

// Three.js Core
let scene, camera, renderer, composer;
let vhsPass, glitchPass, crtPass;
let sphere, terrain, tunnel, circularGroup, barsGroup;
let brandSprite;

// DOM Elements
const canvas = document.getElementById('visualizer');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileBtn = document.getElementById('file-btn');
const playBtn = document.getElementById('play-btn');
const stopPreviewBtn = document.getElementById('stop-preview-btn');
const recordBtn = document.getElementById('record-btn');
const stopBtn = document.getElementById('stop-btn');
const statusBadge = document.getElementById('status');
const styleSelect = document.getElementById('style-select');
const palettes = document.querySelectorAll('.palette');
const recordingOverlay = document.getElementById('recording-overlay');
const sensitivitySlider = document.getElementById('sensitivity');

// Toggles
const vhsToggle = document.getElementById('vhs-toggle');
const crtToggle = document.getElementById('crt-toggle');
const glitchToggle = document.getElementById('glitch-toggle');
const spectroToggle = document.getElementById('spectro-toggle');

// Branding
const brandBtn = document.getElementById('brand-btn');
const brandInput = document.getElementById('brand-input');
const brandScale = document.getElementById('brand-scale');
const brandPos = document.getElementById('brand-pos');
const brandControls = document.getElementById('brand-controls');

// Config
let config = {
  sensitivity: 5,
  colors: ['#00f2ff', '#ff00ea'],
  style: '3d-sphere'
};

// Cache dimensions
let width, height, centerX, centerY, radius;

// --- Initialization ---

function initThree() {
  scene = new THREE.Scene();
  width = canvas.offsetWidth;
  height = canvas.offsetHeight;
  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 5;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.5, 0.4, 0.85);
  composer.addPass(bloomPass);

  vhsPass = new ShaderPass(VHSShader);
  vhsPass.enabled = false;
  composer.addPass(vhsPass);

  glitchPass = new ShaderPass(GlitchShader);
  glitchPass.enabled = false;
  composer.addPass(glitchPass);

  crtPass = new ShaderPass(CRTShader);
  crtPass.enabled = false;
  composer.addPass(crtPass);
  
  initGeometries();
}

function initGeometries() {
  // 3D Sphere
  const sphereGeo = new THREE.IcosahedronGeometry(1.5, 64);
  const sphereMat = new THREE.MeshPhongMaterial({
    color: config.colors[0],
    wireframe: true,
    emissive: config.colors[0],
    emissiveIntensity: 0.5
  });
  sphere = new THREE.Mesh(sphereGeo, sphereMat);
  scene.add(sphere);

  // Terrain
  const terrainGeo = new THREE.PlaneGeometry(20, 20, 64, 64);
  const terrainMat = new THREE.MeshPhongMaterial({
    color: config.colors[1],
    wireframe: true,
    side: THREE.DoubleSide
  });
  terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = -2;
  scene.add(terrain);
  terrain.visible = false;

  // Hyper Tunnel
  const tunnelGeo = new THREE.CylinderGeometry(5, 5, 100, 32, 100, true);
  const tunnelMat = new THREE.MeshPhongMaterial({
    color: config.colors[0],
    wireframe: true,
    side: THREE.BackSide
  });
  tunnel = new THREE.Mesh(tunnelGeo, tunnelMat);
  tunnel.rotation.x = Math.PI / 2;
  scene.add(tunnel);
  tunnel.visible = false;

  // Circular Style (3D)
  circularGroup = new THREE.Group();
  for (let i = 0; i < 128; i++) {
    const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const mat = new THREE.MeshPhongMaterial({ color: config.colors[0] });
    const bar = new THREE.Mesh(geo, mat);
    circularGroup.add(bar);
  }
  scene.add(circularGroup);
  circularGroup.visible = false;

  // Bars Style (3D)
  barsGroup = new THREE.Group();
  for (let i = 0; i < 64; i++) {
    const geo = new THREE.BoxGeometry(0.2, 0.1, 0.1);
    const mat = new THREE.MeshPhongMaterial({ color: config.colors[0] });
    const bar = new THREE.Mesh(geo, mat);
    bar.position.x = (i - 32) * 0.3;
    barsGroup.add(bar);
  }
  scene.add(barsGroup);
  barsGroup.visible = false;

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  const pointLight = new THREE.PointLight(0xffffff, 1);
  pointLight.position.set(5, 5, 5);
  scene.add(pointLight);
}

initThree();

// --- Audio Logic ---

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

// --- Animation Loop ---

function animate() {
  animationId = requestAnimationFrame(animate);
  if (analyser) analyser.getByteFrequencyData(dataArray);

  const time = performance.now() * 0.001;
  const avg = analyser ? (dataArray.reduce((a, b) => a + b) / dataArray.length) : 0;
  const bass = analyser ? dataArray[0] : 0;

  updateVisuals(avg, bass, time);
  
  if (vhsPass) {
    vhsPass.uniforms.time.value = time;
    vhsPass.enabled = vhsToggle.checked;
  }
  if (glitchPass) {
    glitchPass.uniforms.time.value = time;
    glitchPass.enabled = glitchToggle.checked || (bass > 240);
  }
  if (crtPass) {
    crtPass.uniforms.time.value = time;
    crtPass.enabled = crtToggle.checked;
  }

  composer.render();
}

function updateVisuals(avg, bass, time) {
  const intensity = (avg / 255) * config.sensitivity;
  const beatScale = 1 + (bass / 255) * 0.2;

  sphere.visible = config.style === '3d-sphere';
  terrain.visible = config.style === '3d-terrain';
  tunnel.visible = config.style === '3d-tunnel';
  circularGroup.visible = config.style.startsWith('circular');
  barsGroup.visible = config.style === 'bars';

  if (config.style === '3d-sphere') {
    sphere.scale.set(beatScale, beatScale, beatScale);
    sphere.rotation.y += 0.01;
    sphere.rotation.x += 0.005;
    sphere.material.emissiveIntensity = intensity;
  }

  if (config.style === '3d-terrain') {
    const positions = terrain.geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i+1];
      positions[i+2] = Math.sin(x * 0.5 + time) * Math.cos(y * 0.5 + time) * intensity;
    }
    terrain.geometry.attributes.position.needsUpdate = true;
    terrain.rotation.z += 0.001;
  }

  if (config.style === '3d-tunnel') {
    tunnel.position.z += 0.2 + (avg / 255) * 1.5;
    if (tunnel.position.z > 50) tunnel.position.z = 0;
    tunnel.rotation.z += 0.005;
    tunnel.scale.set(beatScale, 1, beatScale);
  }

  if (config.style.startsWith('circular')) {
    circularGroup.children.forEach((bar, i) => {
      const angle = (i / 128) * Math.PI * 2;
      const h = (dataArray[i] / 255) * 3 * (config.sensitivity / 5);
      bar.position.set(Math.cos(angle) * 2, Math.sin(angle) * 2, 0);
      bar.scale.set(1, h, 1);
      bar.rotation.z = angle;
    });
  }

  if (config.style === 'bars') {
    barsGroup.children.forEach((bar, i) => {
      const h = (dataArray[i] / 255) * 5 * (config.sensitivity / 5);
      bar.scale.set(1, h, 1);
    });
  }
}

animate();

// --- Event Handlers ---

fileBtn.onclick = () => fileInput.click();
fileInput.onchange = (e) => {
  const file = e.target.files[0];
  if (file) {
    audioFile = file;
    dropZone.classList.add('hidden');
    playBtn.disabled = false;
    recordBtn.disabled = false;
    statusBadge.textContent = '3D Engine Ready: ' + file.name;
  }
};

brandBtn.onclick = () => brandInput.click();
brandInput.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const loader = new THREE.TextureLoader();
    loader.load(event.target.result, (texture) => {
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
      if (brandSprite) scene.remove(brandSprite);
      brandSprite = new THREE.Sprite(material);
      scene.add(brandSprite);
      brandControls.classList.remove('hidden');
      brandBtn.textContent = 'Change Logo';
      updateBrandPosition();
    });
  };
  reader.readAsDataURL(file);
};

function updateBrandPosition() {
  if (!brandSprite) return;
  const scale = brandScale.value / 100;
  brandSprite.scale.set(scale * 2, scale * 2, 1);
  
  if (brandPos.value === 'top-right') brandSprite.position.set(3, 2, 0);
  if (brandPos.value === 'top-left') brandSprite.position.set(-3, 2, 0);
  if (brandPos.value === 'bottom-right') brandSprite.position.set(3, -2, 0);
  if (brandPos.value === 'bottom-left') brandSprite.position.set(-3, -2, 0);
  if (brandPos.value === 'center') brandSprite.position.set(0, 0, 0);
}

brandPos.onchange = updateBrandPosition;
brandScale.oninput = updateBrandPosition;
sensitivitySlider.oninput = (e) => config.sensitivity = e.target.value;
styleSelect.onchange = (e) => config.style = e.target.value;

playBtn.onclick = async () => {
  const source = await setupAudio();
  source.start(0);
  statusBadge.textContent = '3D Preview Active';
  playBtn.disabled = true;
  stopPreviewBtn.disabled = false;
};

stopPreviewBtn.onclick = () => {
  if (audioSource) audioSource.stop();
  playBtn.disabled = false;
  stopPreviewBtn.disabled = true;
  statusBadge.textContent = 'Engine Standby';
};

recordBtn.onclick = async () => {
  const source = await setupAudio();
  const dest = audioContext.createMediaStreamDestination();
  analyser.connect(dest);
  const canvasStream = canvas.captureStream(60);
  const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 15000000 });
  recordedChunks = [];
  mediaRecorder.ondataavailable = (e) => recordedChunks.push(e.data);
  mediaRecorder.onstop = exportVideo;
  recordingOverlay.style.display = 'flex';
  source.start(0);
  mediaRecorder.start();
  source.onended = () => mediaRecorder.stop();
};

async function exportVideo() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const formData = new FormData();
  formData.append('video', blob);
  statusBadge.textContent = 'Final 3D Encoding...';
  try {
    const res = await fetch('http://localhost:3001/api/encode', { method: 'POST', body: formData });
    if (res.ok) {
      const result = await res.blob();
      const url = URL.createObjectURL(result);
      const a = document.createElement('a'); a.href = url; a.download = 'ChombieWombie-3D.mp4'; a.click();
    }
  } catch (err) { console.error(err); }
  recordingOverlay.style.display = 'none';
  statusBadge.textContent = 'Export Complete';
}
