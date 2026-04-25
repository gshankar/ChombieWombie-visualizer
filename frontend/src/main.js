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

// --- Initialization ---

function initThree() {
  scene = new THREE.Scene();
  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;
  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 5;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 2.5, 0.5, 0.85);
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
    color: new THREE.Color(config.colors[0]),
    wireframe: true,
    emissive: new THREE.Color(config.colors[0]),
    emissiveIntensity: 1.0
  });
  sphere = new THREE.Mesh(sphereGeo, sphereMat);
  scene.add(sphere);

  // Terrain
  const terrainGeo = new THREE.PlaneGeometry(30, 30, 100, 100);
  const terrainMat = new THREE.MeshPhongMaterial({
    color: new THREE.Color(config.colors[1]),
    wireframe: true,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });
  terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = -3;
  scene.add(terrain);
  terrain.visible = false;

  // Hyper Tunnel
  const tunnelGeo = new THREE.CylinderGeometry(5, 5, 100, 64, 100, true);
  const tunnelMat = new THREE.MeshPhongMaterial({
    color: new THREE.Color(config.colors[0]),
    wireframe: true,
    side: THREE.BackSide,
    emissive: new THREE.Color(config.colors[0]),
    emissiveIntensity: 0.5
  });
  tunnel = new THREE.Mesh(tunnelGeo, tunnelMat);
  tunnel.rotation.x = Math.PI / 2;
  scene.add(tunnel);
  tunnel.visible = false;

  // Circular Style (High Fidelity 3D)
  circularGroup = new THREE.Group();
  const barCount = 256;
  for (let i = 0; i < barCount; i++) {
    const geo = new THREE.BoxGeometry(0.05, 1, 0.05);
    const mat = new THREE.MeshPhongMaterial({ 
      color: new THREE.Color(config.colors[0]),
      emissive: new THREE.Color(config.colors[0]),
      emissiveIntensity: 1.0
    });
    const bar = new THREE.Mesh(geo, mat);
    circularGroup.add(bar);
  }
  scene.add(circularGroup);
  circularGroup.visible = false;

  // Bars Style (High Fidelity 3D)
  barsGroup = new THREE.Group();
  for (let i = 0; i < 128; i++) {
    const geo = new THREE.BoxGeometry(0.15, 1, 0.1);
    const mat = new THREE.MeshPhongMaterial({ 
      color: new THREE.Color(config.colors[1]),
      emissive: new THREE.Color(config.colors[1]),
      emissiveIntensity: 0.5
    });
    const bar = new THREE.Mesh(geo, mat);
    bar.position.x = (i - 64) * 0.2;
    barsGroup.add(bar);
  }
  scene.add(barsGroup);
  barsGroup.visible = false;

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);
  const p1 = new THREE.PointLight(config.colors[0], 2);
  p1.position.set(5, 5, 5);
  scene.add(p1);
}

initThree();

function updateColors() {
  const c1 = new THREE.Color(config.colors[0]);
  const c2 = new THREE.Color(config.colors[1]);
  
  sphere.material.color = c1;
  sphere.material.emissive = c1;
  
  terrain.material.color = c2;
  
  tunnel.material.color = c1;
  tunnel.material.emissive = c1;
  
  circularGroup.children.forEach(bar => {
    bar.material.color = c1;
    bar.material.emissive = c1;
  });
  
  barsGroup.children.forEach(bar => {
    bar.material.color = c2;
    bar.material.emissive = c2;
  });
}

// --- Audio Logic ---

async function setupAudio() {
  if (audioContext) await audioContext.close();
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024; // Better resolution
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
  const treble = analyser ? dataArray[dataArray.length - 10] : 0;

  updateVisuals(avg, bass, treble, time);
  
  if (vhsPass) {
    vhsPass.uniforms.time.value = time;
    vhsPass.enabled = vhsToggle.checked;
  }
  if (glitchPass) {
    glitchPass.uniforms.time.value = time;
    glitchPass.enabled = glitchToggle.checked || (bass > 245);
  }
  if (crtPass) {
    crtPass.uniforms.time.value = time;
    crtPass.enabled = crtToggle.checked;
  }

  composer.render();
}

function updateVisuals(avg, bass, treble, time) {
  const intensity = (avg / 255) * config.sensitivity;
  const beatScale = 1 + (bass / 255) * 0.3;

  sphere.visible = config.style === '3d-sphere';
  terrain.visible = config.style === '3d-terrain';
  tunnel.visible = config.style === '3d-tunnel';
  circularGroup.visible = config.style.startsWith('circular');
  barsGroup.visible = config.style === 'bars';

  if (config.style === '3d-sphere') {
    sphere.scale.set(beatScale, beatScale, beatScale);
    sphere.rotation.y += 0.01 + (treble / 1000);
    sphere.material.emissiveIntensity = intensity * 2;
  }

  if (config.style === '3d-terrain') {
    const positions = terrain.geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i+1];
      const d = Math.sqrt(x*x + y*y);
      positions[i+2] = Math.sin(d * 0.5 - time * 2) * intensity * 2;
    }
    terrain.geometry.attributes.position.needsUpdate = true;
  }

  if (config.style === '3d-tunnel') {
    tunnel.position.z += 0.5 + (intensity * 2);
    if (tunnel.position.z > 50) tunnel.position.z = 0;
    tunnel.rotation.z += 0.01;
    tunnel.scale.set(beatScale, 1, beatScale);
  }

  if (config.style.startsWith('circular')) {
    const isInner = config.style === 'circular-inner';
    const isDual = config.style === 'circular-dual';
    
    circularGroup.children.forEach((bar, i) => {
      const angle = (i / circularGroup.children.length) * Math.PI * 2;
      const h = (dataArray[i % dataArray.length] / 255) * 4 * (config.sensitivity / 5);
      
      const r = 2.5;
      bar.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
      bar.scale.set(1, h, 1);
      bar.rotation.z = angle + Math.PI/2;
      
      if (isInner) {
        bar.position.set(Math.cos(angle) * (r - h/2), Math.sin(angle) * (r - h/2), 0);
      } else if (isDual) {
        bar.scale.set(1, h * 2, 1);
      }
    });
  }

  if (config.style === 'bars') {
    barsGroup.children.forEach((bar, i) => {
      const h = (dataArray[i % dataArray.length] / 255) * 8 * (config.sensitivity / 5);
      bar.scale.set(1, h, 1);
      bar.position.y = -2 + h/2;
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
    statusBadge.textContent = 'Track Ready: ' + file.name;
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
  brandSprite.scale.set(scale * 3, scale * 3, 1);
  if (brandPos.value === 'top-right') brandSprite.position.set(3.5, 2.5, 0);
  if (brandPos.value === 'top-left') brandSprite.position.set(-3.5, 2.5, 0);
  if (brandPos.value === 'bottom-right') brandSprite.position.set(3.5, -2.5, 0);
  if (brandPos.value === 'bottom-left') brandSprite.position.set(-3.5, -2.5, 0);
  if (brandPos.value === 'center') brandSprite.position.set(0, 0, 0);
}

brandPos.onchange = updateBrandPosition;
brandScale.oninput = updateBrandPosition;
sensitivitySlider.oninput = (e) => config.sensitivity = e.target.value;
styleSelect.onchange = (e) => config.style = e.target.value;
palettes.forEach(p => {
  p.onclick = () => {
    palettes.forEach(btn => btn.classList.remove('active'));
    p.classList.add('active');
    config.colors = p.dataset.colors.split(',');
    updateColors();
  };
});

playBtn.onclick = async () => {
  const source = await setupAudio();
  source.start(0);
  statusBadge.textContent = 'Live Preview';
  playBtn.disabled = true;
  stopPreviewBtn.disabled = false;
};

stopPreviewBtn.onclick = () => {
  if (audioSource) audioSource.stop();
  playBtn.disabled = false;
  stopPreviewBtn.disabled = true;
  statusBadge.textContent = 'Stopped';
};
