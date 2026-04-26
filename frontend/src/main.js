import './style.css'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { VHSShader, GlitchShader, CRTShader } from './shaders.js'
import { STYLES, DEFAULT_CONFIG, FEATURE_FLAGS } from './config.js'

// Global Config & State
let config = { ...DEFAULT_CONFIG };
let audioFile, audioContext, analyser, dataArray, animationId, audioSource;
let brandImage = null;
let hueOffset = 0;
let cycleInterval = null;
let smoothAvg = 0, smoothBass = 0;
let lastStyleCycleTime = 0;
let nextStyleCycleInterval = 30; // seconds

// Visual States
let bouncingCubeState = { pos: new THREE.Vector3(0,0,0), vel: new THREE.Vector3(0.08, 0.06, 0.04) };
let cityBuildings = [];
let originalSpherePos = null;

// Core Engines
let scene, camera, renderer, composer, canvasTexture, canvasPlane;
let brandingScene, brandingCamera, logoSprite;
let vhsPass, glitchPass, crtPass, bloomPass;
let sphere, terrain, tunnel, stars, bouncingCube, cityContainer;

const isHeadless = new URLSearchParams(window.location.search).get('headless') === 'true';
const get = (id) => document.getElementById(id);

// --- Initialization ---

function init() {
  console.log('ChombieWombie Engine: Initializing Studio Pipeline...');
  try {
    updateStyleOptions();
    updateCycleOptions();
    attachEventListeners();
    initThree();
    initStyles();
    resize();
    
    if (isHeadless) {
      document.body.classList.add('headless');
      setupHeadlessAPI();
    }
    if (!FEATURE_FLAGS.enableBranding) {
      const g = get('branding-group'); if (g) g.style.display = 'none';
    }
    const s = get('status'); if (s) s.textContent = 'Ready';
  } catch (err) {
    console.error('Initialization Failed:', err);
  }
}

function initThree() {
  const c3 = get('visualizer-3d'), c2 = get('visualizer-2d');
  if (!c3 || !c2) throw new Error('Canvas not found');

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, 1, 0.1, 2000);
  camera.position.z = 10;

  brandingScene = new THREE.Scene();
  brandingCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  brandingCamera.position.z = 10;

  renderer = new THREE.WebGLRenderer({ canvas: c3, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.autoClear = false;
  renderer.setPixelRatio(window.devicePixelRatio);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  
  vhsPass = new ShaderPass(VHSShader); vhsPass.enabled = false; composer.addPass(vhsPass);
  glitchPass = new ShaderPass(GlitchShader); glitchPass.enabled = false; composer.addPass(glitchPass);
  crtPass = new ShaderPass(CRTShader); crtPass.enabled = false; composer.addPass(crtPass);
  bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
  composer.addPass(bloomPass);

  canvasTexture = new THREE.CanvasTexture(c2);
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
  // Reset procedural states if needed
}

// --- Handlers ---

function attachEventListeners() {
  const es = get('engine-select'), ss = get('style-select'), sen = get('sensitivity'), dz = get('drop-zone');
  const tb = get('track-btn'), ti = get('track-input'), pb = get('play-btn'), sp = get('stop-preview-btn'), rb = get('record-btn');
  
  if (es) es.onchange = (e) => { config.engine = e.target.value; updateStyleOptions(); updateCycleOptions(); };
  if (ss) ss.onchange = (e) => config.style = e.target.value;
  if (sen) sen.oninput = (e) => config.sensitivity = e.target.value;
  if (dz) {
    dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('drag-over'); };
    dz.ondragleave = () => dz.classList.remove('drag-over');
    dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove('drag-over'); handleFile(e.dataTransfer.files[0]); };
  }
  if (tb) tb.onclick = () => ti.click();
  if (ti) ti.onchange = (e) => handleFile(e.target.files[0]);
  if (pb) pb.onclick = handlePlay;
  if (sp) sp.onclick = stopPreview;
  if (rb) rb.onclick = handleRecord;
  const reb = get('reset-engine-btn');
  if (reb) reb.onclick = handleResetBackend;

  document.querySelectorAll('.palette').forEach(p => {
    p.onclick = () => {
      document.querySelectorAll('.palette').forEach(b => b.classList.remove('active'));
      p.classList.add('active'); config.colors = p.dataset.colors.split(','); get('color-cycle-toggle').checked = false;
    };
  });
}

function handleFile(file) {
  const isAudio = file && (file.type.startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a)$/i.test(file.name));
  if (isAudio) {
    audioFile = file; get('track-slot').classList.add('ready'); 
    get('track-slot').querySelector('.slot-status').textContent = 'Received';
    get('play-btn').disabled = false; get('record-btn').disabled = false;
    get('drop-zone').querySelector('h2').textContent = 'Session Ready';
    get('status').textContent = 'Armed';
  } else {
    showError('Invalid file. Use MP3/WAV.');
  }
}

async function handlePlay() {
  get('drop-zone').classList.add('hidden'); get('loading-overlay').classList.remove('hidden');
  try {
    if (audioContext) await audioContext.close();
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser(); analyser.fftSize = 512;
    const buf = await audioContext.decodeAudioData(await audioFile.arrayBuffer());
    audioSource = audioContext.createBufferSource(); audioSource.buffer = buf;
    audioSource.connect(analyser); analyser.connect(audioContext.destination);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    get('loading-overlay').classList.add('hidden'); audioSource.start(0); draw();
    get('play-btn').disabled = true; get('stop-preview-btn').disabled = false;
    const engineSelect = get('engine-select');
    if (engineSelect) engineSelect.disabled = true;
    audioSource.onended = stopPreview;
  } catch (err) {
    showError('Playback error'); get('loading-overlay').classList.add('hidden');
  }
}

function stopPreview() {
  if (audioSource) audioSource.stop(); cancelAnimationFrame(animationId);
  get('play-btn').disabled = false; get('stop-preview-btn').disabled = true;
  const engineSelect = get('engine-select');
  if (engineSelect) engineSelect.disabled = false;
  get('drop-zone').classList.remove('hidden');
}

// --- Visual Rendering Loop ---

function draw() {
  if (!isHeadless) animationId = requestAnimationFrame(draw);
  const time = performance.now() * 0.001;
  const c2 = get('visualizer-2d'), ctx = c2?.getContext('2d');
  if (!analyser || !ctx) return;

  analyser.getByteFrequencyData(dataArray);
  const avg = dataArray.reduce((a,b) => a+b) / dataArray.length;
  const bass = dataArray.slice(0, 12).reduce((a,b) => a+b) / 12;
  smoothAvg += (avg - smoothAvg) * 0.15; smoothBass += (bass - smoothBass) * 0.15;
  
  if (get('color-cycle-toggle')?.checked) { 
    hueOffset = (hueOffset + 0.5) % 360; 
    config.colors = [`hsl(${hueOffset}, 100%, 50%)`, `hsl(${(hueOffset + 60) % 360}, 100%, 50%)` ]; 
  }

  // Random Visual Cycling Logic
  if (get('cycle-toggle')?.checked && time - lastStyleCycleTime > nextStyleCycleInterval) {
    const enabled = Array.from(document.querySelectorAll('.cycle-style:checked')).map(el => el.value);
    if (enabled.length > 0) {
      const randomStyle = enabled[Math.floor(Math.random() * enabled.length)];
      config.style = randomStyle;
      get('style-select').value = randomStyle;
      lastStyleCycleTime = time;
      nextStyleCycleInterval = 30 + Math.random() * 90; // Random interval between 30s and 120s
    }
  }
  
  draw2D(ctx, c2, time); 
  renderUnified(time);
}

function draw2D(ctx, canvas, time) {
  const w = canvas.width, h = canvas.height, dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, w, h);
  if (config.engine !== '2d') return;
  
  // Radius optimized for cinematic impact and safety (YT 16:9 safe zone)
  const r = Math.min(w, h) / 6; // Drastically smaller for safe fit
  const sens = config.sensitivity;
  ctx.strokeStyle = config.colors[0]; 
  ctx.lineWidth = 1.5 * dpr; // Much thinner for premium look
  ctx.lineCap = 'round';
  const intensity = (smoothAvg/255) * sens;

  if (config.style.startsWith('circular')) {
    const bars = dataArray.length;
    for (let i = 0; i < bars; i++) {
      const bh = (dataArray[i]/255) * r * (sens/10); // Much shorter bars
      const a = (i/bars) * Math.PI * 2;
      let x1, y1, x2, y2;
      if (config.style === 'circular') {
        x1 = w/2 + Math.cos(a)*r; y1 = h/2 + Math.sin(a)*r; 
        x2 = w/2 + Math.cos(a)*(r+bh); y2 = h/2 + Math.sin(a)*(r+bh);
      } else if (config.style === 'circular-inner') {
        x1 = w/2 + Math.cos(a)*r; y1 = h/2 + Math.sin(a)*r; 
        x2 = w/2 + Math.cos(a)*(r-bh); y2 = h/2 + Math.sin(a)*(r-bh);
      } else {
        x1 = w/2 + Math.cos(a)*(r-bh/2); y1 = h/2 + Math.sin(a)*(r-bh/2); 
        x2 = w/2 + Math.cos(a)*(r+bh/2); y2 = h/2 + Math.sin(a)*(r+bh/2);
      }
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  } else if (config.style === 'sunrise') {
    const sunriseY = h * 0.75; // Locked to lower third
    const sr = r * 1.1; 
    for (let i = 0; i < dataArray.length; i++) {
      const bh = (dataArray[i]/255) * r * (sens/12); // Shorter rays
      const a = Math.PI + (i/dataArray.length) * Math.PI;
      ctx.beginPath(); 
      ctx.moveTo(w/2+Math.cos(a)*(sr-bh/2), sunriseY+Math.sin(a)*(sr-bh/2));
      ctx.lineTo(w/2+Math.cos(a)*(sr+bh/2), sunriseY+Math.sin(a)*(sr+bh/2)); 
      ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(w*0.1, sunriseY); ctx.lineTo(w*0.9, sunriseY); ctx.stroke();
  } else if (config.style === 'cyber-nebula') {
    const bs = 12;
    for (let x=0; x<w; x+=bs) {
      for (let y=0; y<h; y+=bs) {
        const v1 = Math.sin(x/200 + time);
        const v2 = Math.sin(y/150 + time * 0.5);
        const v3 = Math.sin((x+y)/300 + time);
        const val = (v1 + v2 + v3) / 3;
        ctx.fillStyle = `hsla(${(val*180 + hueOffset)%360}, 100%, 50%, ${0.2 + intensity*0.3})`;
        ctx.fillRect(x,y,bs,bs);
      }
    }
  } else if (config.style === 'aurora') {
    const segments = 20;
    for (let i = 0; i < segments; i++) {
      const shift = Math.sin(time + i * 0.3) * 100 * intensity;
      ctx.beginPath();
      ctx.strokeStyle = `hsla(${(hueOffset + i * 10) % 360}, 100%, 50%, 0.3)`;
      ctx.lineWidth = 40 * dpr;
      ctx.moveTo(0, h * (i / segments) + shift);
      ctx.bezierCurveTo(w * 0.3, h * (i / segments) - shift, w * 0.6, h * (i / segments) + shift, w, h * (i / segments) - shift);
      ctx.stroke();
    }
  }
  else if (config.style === 'plasma') {
    const bs = 10; // Fine grain
    for (let x=0; x<w; x+=bs) {
      for (let y=0; y<h; y+=bs) {
        const v = Math.sin(x/300+time) + Math.sin(y/300+time); // Wide waves
        ctx.fillStyle = `hsla(${(v*200+hueOffset)%360}, 100%, 50%, 0.4)`; ctx.fillRect(x,y,bs,bs);
      }
    }
  } else if (config.style === 'bars') {
    const bw = (w / dataArray.length) * 1.5;
    for (let i = 0; i < dataArray.length; i++) {
      const bh = (dataArray[i]/255) * h * 0.6 * (sens/5); // Taller bars
      ctx.fillStyle = config.colors[0]; ctx.fillRect(i*(bw+1), h*0.85-bh, bw, bh); 
    }
  }
}

function renderUnified(time) {
  const intensity = (smoothAvg/255)*config.sensitivity, bassInt = (smoothBass/255)*config.sensitivity;
  const is3D = config.engine === '3d';
  
  const c2 = get('visualizer-2d'), c3 = get('visualizer-3d');
  // Always show 3D canvas because 2D is rendered onto a 3D plane for post-processing
  if (c2) c2.classList.add('hidden');
  if (c3) c3.classList.remove('hidden');

  if (sphere) sphere.visible = is3D && config.style === '3d-sphere';
  if (terrain) terrain.visible = is3D && config.style === '3d-terrain';
  if (tunnel) tunnel.visible = is3D && config.style === '3d-tunnel';
  if (stars) stars.visible = is3D && config.style === '3d-stars';
  if (bouncingCube) bouncingCube.visible = is3D && config.style === '3d-cube';
  if (cityContainer) cityContainer.visible = is3D && config.style === '3d-city';
  
  if (canvasPlane) {
    canvasPlane.visible = !is3D;
    if (canvasPlane.visible && canvasTexture) {
      canvasTexture.needsUpdate = true;
      // Dynamic scale calculation for exact screen fit (FOV 75, Distance 10)
      const vFOV = (camera.fov * Math.PI) / 180;
      const h = 2 * Math.tan(vFOV / 2) * 10;
      canvasPlane.scale.set(h * camera.aspect, h, 1);
    }
  }
  
  if (is3D) {
    if (config.style === '3d-sphere' || config.style === '3d-cube') {
      camera.position.set(Math.sin(time*0.5)*15, 5, Math.cos(time*0.5)*15); camera.lookAt(0,0,0);
    } else if (config.style === '3d-tunnel') {
      camera.position.set(Math.sin(time*2)*intensity, Math.cos(time*2)*intensity, 10); camera.lookAt(0,0,-50);
    } else {
      camera.position.set(0, 0, 15); camera.lookAt(0,0,0);
    }
    
    if (sphere?.visible) {
      const pos = sphere.geometry.attributes.position.array;
      for (let i=0; i<pos.length; i+=3) {
        const dist = Math.sin(time*2 + originalSpherePos[i]*0.5)*intensity*0.8;
        pos[i] = originalSpherePos[i] + dist; pos[i+1] = originalSpherePos[i+1] + dist; pos[i+2] = originalSpherePos[i+2] + dist;
      }
      sphere.geometry.attributes.position.needsUpdate = true;
      sphere.rotation.y += 0.01; sphere.material.color.set(config.colors[0]);
    }
    if (terrain?.visible) {
      const pos = terrain.geometry.attributes.position.array;
      for (let i=0; i<pos.length; i+=3) pos[i+2] = Math.sin(Math.sqrt(pos[i]*pos[i]+pos[i+1]*pos[i+1])*0.2 - time*2)*intensity*5;
      terrain.geometry.attributes.position.needsUpdate = true; terrain.material.color.set(config.colors[1]);
    }
    if (tunnel?.visible) { tunnel.rotation.z += 0.01; const s = 1+intensity*0.05; tunnel.scale.set(s,s,1); tunnel.material.color.set(config.colors[0]); }
    if (stars?.visible) {
      const p = stars.geometry.attributes.position.array; const speed = 0.1+intensity*0.4;
      for (let i=0; i<p.length; i+=3) { p[i+2]+=speed; if(p[i+2]>100)p[i+2]=-100; }
      stars.geometry.attributes.position.needsUpdate = true; stars.material.color.set(config.colors[0]);
    }
    if (bouncingCube?.visible) {
      const s = 0.5+intensity; bouncingCubeState.pos.add(bouncingCubeState.vel.clone().multiplyScalar(s));
      ['x','y','z'].forEach(k => { if(Math.abs(bouncingCubeState.pos[k]) > 5) bouncingCubeState.vel[k]*=-1; });
      bouncingCube.position.copy(bouncingCubeState.pos); bouncingCube.rotation.x+=0.02; bouncingCube.material.color.set(config.colors[0]);
    }
    if (cityContainer?.visible) {
      const speed = 0.2+intensity*0.4; cityBuildings.forEach(b => {
        b.position.z += speed; if(b.position.z>20)b.position.z=-200;
        b.scale.y = 1+bassInt*0.8; b.material.color.set(config.colors[0]);
      });
    }

    vhsPass.enabled = get('vhs-toggle')?.checked; 
    crtPass.enabled = get('crt-toggle')?.checked; 
    glitchPass.enabled = get('glitch-toggle')?.checked;
    bloomPass.strength = 1.2 + (smoothBass/255)*0.8;
    renderer.clear(); composer.render();
  } else {
    // 2D Pass-through to 3D Composer for effects
    camera.position.set(0, 0, 10); camera.lookAt(0,0,0);
    vhsPass.enabled = get('vhs-toggle')?.checked; 
    crtPass.enabled = get('crt-toggle')?.checked; 
    glitchPass.enabled = get('glitch-toggle')?.checked;
    bloomPass.strength = 1.0 + (smoothBass/255)*0.5;
    renderer.clear(); composer.render();
  }
}

function resize() {
  const c3 = get('visualizer-3d'), c2 = get('visualizer-2d'); if (!c3 || !c2 || !c3.parentElement) return;
  
  let w, h, dpr;
  if (isHeadless) {
    w = 1920; h = 1080; dpr = 1;
  } else {
    w = c3.parentElement.offsetWidth; h = c3.parentElement.offsetHeight;
    dpr = window.devicePixelRatio || 1;
  }

  renderer.setSize(w, h); renderer.setPixelRatio(dpr); composer.setSize(w, h);
  camera.aspect = w/h; camera.updateProjectionMatrix();
  c2.width = w * dpr; c2.height = h * dpr;
}

// --- Headless / Studio Render ---

async function handleRecord() {
  if (!audioFile) return showError('Upload a track first');
  
  // 1. Show UI Immediately
  get('recording-overlay').classList.remove('hidden');
  get('render-progress-bar').style.width = '0%';
  get('render-status-text').textContent = 'Phase 1: Preparing Mac Studio Engine...';
  get('render-progress-text').textContent = 'Analyzing frequency map...';

  // 2. Wait for UI to render before starting heavy task
  await new Promise(r => setTimeout(r, 100));

  try {
    console.log('Starting Audio Analysis...');
    const map = await getAudioDataMap((progress) => {
      get('render-progress-bar').style.width = `${progress * 0.15}%`; // Analysis is first 15%
      get('render-progress-text').textContent = `Extracting waveform data (${Math.round(progress)}%)`;
    });

    console.log('Analysis Complete. Sending to Backend...');
    get('render-status-text').textContent = 'Phase 2: Handshaking with Render Server...';
    
    const fd = new FormData();
    fd.append('audio', audioFile);
    fd.append('dataMap', JSON.stringify(map));
    fd.append('config', JSON.stringify({ 
      ...config, 
      vhs: get('vhs-toggle').checked, 
      crt: get('crt-toggle').checked, 
      glitch: get('glitch-toggle').checked 
    }));

    const res = await fetch('http://localhost:3001/api/render-headless', { 
      method: 'POST', 
      body: fd 
    });

    if (!res.ok) throw new Error(await res.text());

    const { jobId } = await res.json();
    let startTime = Date.now();

    const poll = setInterval(async () => {
      try {
        const s = await fetch(`http://localhost:3001/api/render-status/${jobId}`);
        if (s.ok) {
          const { status, progress, error } = await s.json();
          if (status === 'rendering') {
            const totalProgress = 20 + (progress * 0.8); // Rendering is remaining 80%
            get('render-progress-bar').style.width = `${totalProgress}%`;
            get('render-progress-text').textContent = `Rendering Frames (${progress}%)`;
            get('render-status-text').textContent = 'Phase 3: Visual Synthesis in Progress...';
          } else if (status === 'done') {
            clearInterval(poll);
            get('render-progress-bar').style.width = '100%';
            get('render-progress-text').textContent = 'Export Complete!';
            get('render-status-text').textContent = 'Preparing Download...';
            window.location.href = `http://localhost:3001/api/render-download/${jobId}`;
            setTimeout(() => get('recording-overlay').classList.add('hidden'), 3000);
          } else if (status === 'error') {
            throw new Error(error);
          }
        }
      } catch (pollErr) {
        clearInterval(poll);
        showError(`Render failed: ${pollErr.message}`);
        get('recording-overlay').classList.add('hidden');
      }
    }, 1500);
  } catch (err) {
    showError(`Studio Render Error: ${err.message}`);
    get('recording-overlay').classList.add('hidden');
  }
}

async function handleResetBackend() {
  const btn = get('reset-engine-btn');
  const originalText = btn.textContent;
  
  if (!confirm('Are you sure you want to reset the Studio Engine? This will clear all active render jobs.')) {
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Resetting...';

  try {
    const res = await fetch('http://localhost:3001/api/reset', { method: 'POST' });
    if (!res.ok) throw new Error('Reset failed');
    
    const data = await res.json();
    alert(data.message || 'Studio Engine Reset Successful');
  } catch (err) {
    showError(`Reset Error: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function getAudioDataMap(onProgress) {
  const tCtx = new (window.AudioContext || window.webkitAudioContext)();
  const buf = await tCtx.decodeAudioData(await audioFile.arrayBuffer());
  const oCtx = new OfflineAudioContext(1, Math.ceil(buf.duration * 44100), 44100);
  const src = oCtx.createBufferSource(); src.buffer = buf;
  const ans = oCtx.createAnalyser(); ans.fftSize = 512;
  src.connect(ans); ans.connect(oCtx.destination);
  const fps = 60, total = Math.ceil(buf.duration * fps), map = [];
  src.start(0);
  for (let i = 0; i < total; i++) {
    await oCtx.suspend(i / fps);
    const data = new Uint8Array(ans.frequencyBinCount); ans.getByteFrequencyData(data);
    map.push(Array.from(data)); oCtx.resume();
    if (i % 50 === 0 && onProgress) {
      onProgress((i / total) * 100);
      await new Promise(r => setTimeout(r, 0)); // Give UI thread a break
    }
  }
  return map;
}

function setupHeadlessAPI() {
  window.renderFrame = async (idx, data, cfg, time) => {
    config = { ...config, ...cfg }; dataArray = new Uint8Array(data);
    draw2D(get('visualizer-2d')?.getContext('2d'), get('visualizer-2d'), time);
    renderUnified(time); return get('visualizer-3d').toDataURL();
  };
}

function updateStyleOptions() { get('style-select').innerHTML = STYLES[config.engine].map(s => `<option value="${s.id}">${s.name}</option>`).join(''); config.style = STYLES[config.engine][0].id; }
function updateCycleOptions() { get('cycle-style-list').innerHTML = STYLES[config.engine].map(s => `<label><input type="checkbox" class="cycle-style" value="${s.id}" checked> ${s.name}</label>`).join(''); }
function showError(m) { get('upload-error').textContent = m; get('upload-error').classList.remove('hidden'); }

init();
