import './style.css'

// State management
let audioContext, analyser, source, dataArray, animationId, mediaRecorder;
let recordedChunks = [];
let audioFile, audioSource;
let isRecording = false;
let brandImage = null;

// Screensaver States
let stars = [];
let bounceX = 100, bounceY = 100, dx = 2.5, dy = 2.5;
let cycleInterval = null;

// DOM Elements
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d', { alpha: false }); // Performance optimization
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileBtn = document.getElementById('file-btn');
const playBtn = document.getElementById('play-btn');
const stopPreviewBtn = document.getElementById('stop-preview-btn');
const recordBtn = document.getElementById('record-btn');
const stopBtn = document.getElementById('stop-btn');
const statusBadge = document.getElementById('status');
const sensitivitySlider = document.getElementById('sensitivity');
const styleSelect = document.getElementById('style-select');
const palettes = document.querySelectorAll('.palette');
const recordingOverlay = document.getElementById('recording-overlay');

// Toggles
const cycleToggle = document.getElementById('cycle-toggle');
const cycleSelection = document.getElementById('cycle-selection');
const cycleStyleCheckboxes = document.querySelectorAll('.cycle-style');
const floatToggle = document.getElementById('float-toggle');
const spectroToggle = document.getElementById('spectro-toggle');

// Branding Elements
const brandBtn = document.getElementById('brand-btn');
const brandInput = document.getElementById('brand-input');
const brandControls = document.getElementById('brand-controls');
const brandPos = document.getElementById('brand-pos');
const brandScale = document.getElementById('brand-scale');

// Configuration
let config = {
  sensitivity: 5,
  colors: ['#00f2ff', '#ff00ea'],
  style: 'circular',
  brandPos: 'top-right',
  brandScale: 20
};

// Initialize Stars
function initStars() {
  stars = [];
  for(let i = 0; i < 400; i++) {
    stars.push({
      x: Math.random() * 2000 - 1000,
      y: Math.random() * 2000 - 1000,
      z: Math.random() * 1000
    });
  }
}
initStars();

// Cache canvas dimensions
let width, height, centerX, centerY, radius;
function resize() {
  width = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
  height = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
  centerX = width / 2;
  centerY = height / 2;
  radius = Math.min(width, height) / 4;
}
window.addEventListener('resize', resize);
resize();

// File Handling
fileBtn.onclick = () => fileInput.click();
fileInput.onchange = (e) => handleFile(e.target.files[0]);

dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); };
dropZone.ondragleave = () => dropZone.classList.remove('drag-over');
dropZone.ondrop = (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFile(e.dataTransfer.files[0]);
};

function handleFile(file) {
  if (!file || !file.type.startsWith('audio/')) return;
  audioFile = file;
  dropZone.classList.add('hidden');
  playBtn.disabled = false;
  recordBtn.disabled = false;
  statusBadge.textContent = 'Track Loaded: ' + file.name;
}

brandBtn.onclick = () => brandInput.click();
brandInput.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    brandImage = new Image();
    brandImage.src = event.target.result;
    brandImage.onload = () => {
      brandControls.classList.remove('hidden');
      brandBtn.textContent = 'Change Logo';
    };
  };
  reader.readAsDataURL(file);
};

// Audio Setup
async function setupAudio() {
  if (audioContext) await audioContext.close();
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.85;
  const buffer = await audioFile.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(buffer);
  audioSource = audioContext.createBufferSource();
  audioSource.buffer = audioBuffer;
  audioSource.connect(analyser);
  analyser.connect(audioContext.destination);
  dataArray = new Uint8Array(analyser.frequencyBinCount);
  return audioSource;
}

// Optimized Draw Loop
function draw() {
  animationId = requestAnimationFrame(draw);
  analyser.getByteFrequencyData(dataArray);
  
  // Single clear for performance
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  
  const sens = config.sensitivity;
  const bars = dataArray.length;
  let sum = 0;
  for(let i = 0; i < bars; i++) sum += dataArray[i];
  const avg = sum / bars;

  ctx.lineCap = 'round';
  ctx.lineWidth = 2;

  switch(config.style) {
    case 'circular': drawCircular(bars, sens, 'out'); break;
    case 'circular-inner': drawCircular(bars, sens, 'in'); break;
    case 'circular-dual': drawCircular(bars, sens, 'dual'); break;
    case 'starfield': drawStarfield(avg); break;
    case 'bouncing': drawBouncing(avg); break;
    case 'bars': drawBars(bars, sens); break;
    case 'wave': drawWave(bars, sens); break;
  }

  if (spectroToggle.checked) drawSpectro();
  if (brandImage && !floatToggle.checked && config.style !== 'bouncing') drawBranding();
}

function drawCircular(bars, sens, dir) {
  ctx.strokeStyle = config.colors[0];
  for (let i = 0; i < bars; i++) {
    const barHeight = (dataArray[i] / 255) * radius * (sens / 5);
    const angle = (i / bars) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    let x1, y1, x2, y2;
    if (dir === 'out') {
      x1 = centerX + cos * radius; y1 = centerY + sin * radius;
      x2 = centerX + cos * (radius + barHeight); y2 = centerY + sin * (radius + barHeight);
    } else if (dir === 'in') {
      x1 = centerX + cos * radius; y1 = centerY + sin * radius;
      x2 = centerX + cos * (radius - barHeight); y2 = centerY + sin * (radius - barHeight);
    } else {
      x1 = centerX + cos * (radius - barHeight/2); y1 = centerY + sin * (radius - barHeight/2);
      x2 = centerX + cos * (radius + barHeight/2); y2 = centerY + sin * (radius + barHeight/2);
    }
    
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    
    // Symmetrical
    const nCos = Math.cos(-angle);
    const nSin = Math.sin(-angle);
    let sx1, sy1, sx2, sy2;
    if (dir === 'out') {
      sx1 = centerX + nCos * radius; sy1 = centerY + nSin * radius;
      sx2 = centerX + nCos * (radius + barHeight); sy2 = centerY + nSin * (radius + barHeight);
    } else if (dir === 'in') {
      sx1 = centerX + nCos * radius; sy1 = centerY + nSin * radius;
      sx2 = centerX + nCos * (radius - barHeight); sy2 = centerY + nSin * (radius - barHeight);
    } else {
      sx1 = centerX + nCos * (radius - barHeight/2); sy1 = centerY + nSin * (radius - barHeight/2);
      sx2 = centerX + nCos * (radius + barHeight/2); sy2 = centerY + nSin * (radius + barHeight/2);
    }
    ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke();
  }
}

function drawStarfield(avg) {
  const speed = 2 + (avg / 255) * 40;
  ctx.fillStyle = '#fff';
  for(let i = 0; i < stars.length; i++) {
    const s = stars[i];
    s.z -= speed;
    if(s.z <= 0) s.z = 1000;
    const sx = (s.x / s.z) * width + centerX;
    const sy = (s.y / s.z) * height + centerY;
    const size = (1 - s.z / 1000) * 4;
    if (sx > 0 && sx < width && sy > 0 && sy < height) {
      ctx.fillRect(sx, sy, size, size);
    }
  }
}

function drawBouncing(avg) {
  const scale = brandScale.value / 100;
  const bw = brandImage ? brandImage.width * scale : 200;
  const bh = brandImage ? brandImage.height * scale : 50;
  
  if (brandImage) {
    ctx.drawImage(brandImage, bounceX, bounceY, bw, bh);
  } else {
    ctx.fillStyle = config.colors[0];
    ctx.font = 'bold 30px Inter';
    ctx.fillText('CHOMBIE WOMBIE', bounceX, bounceY + 30);
  }
  
  const speedBoost = 1 + (avg / 255) * 4;
  bounceX += dx * speedBoost;
  bounceY += dy * speedBoost;
  if (bounceX <= 0 || bounceX + bw >= width) dx *= -1;
  if (bounceY <= 0 || bounceY + bh >= height) dy *= -1;
}

function drawBranding() {
  const padding = 60;
  const scale = brandScale.value / 100;
  const bw = brandImage.width * scale;
  const bh = brandImage.height * scale;
  let bx, by;
  switch(brandPos.value) {
    case 'top-right': bx = width - bw - padding; by = padding; break;
    case 'top-left': bx = padding; by = padding; break;
    case 'bottom-right': bx = width - bw - padding; by = height - bh - padding; break;
    case 'bottom-left': bx = padding; by = height - bh - padding; break;
    case 'center': bx = centerX - bw/2; by = centerY - bh/2; break;
  }
  ctx.globalAlpha = 0.9;
  ctx.drawImage(brandImage, bx, by, bw, bh);
  ctx.globalAlpha = 1.0;
}

function drawSpectro() {
  const barW = width / dataArray.length;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  for(let i = 0; i < dataArray.length; i++) {
    const barH = (dataArray[i] / 255) * 120;
    ctx.fillRect(i * barW, height - barH, barW, barH);
  }
}

function drawBars(bars, sens) {
  const barWidth = (width / bars) * 2;
  ctx.fillStyle = config.colors[0];
  for(let i = 0; i < bars; i++) {
    const barHeight = (dataArray[i] / 255) * height * 0.4 * (sens / 5);
    ctx.fillRect(i * (barWidth + 2), height - barHeight, barWidth, barHeight);
  }
}

function drawWave(bars, sens) {
  ctx.beginPath();
  ctx.strokeStyle = config.colors[0];
  const sliceWidth = width / bars;
  let x = 0;
  for(let i = 0; i < bars; i++) {
    const v = dataArray[i] / 128.0;
    const y = v * height / 2.5;
    if(i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.stroke();
}

// Handlers
sensitivitySlider.oninput = (e) => config.sensitivity = e.target.value;
styleSelect.onchange = (e) => config.style = e.target.value;
palettes.forEach(p => {
  p.onclick = () => {
    palettes.forEach(btn => btn.classList.remove('active'));
    p.classList.add('active');
    config.colors = p.dataset.colors.split(',');
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

floatToggle.onchange = () => { if (floatToggle.checked) config.style = 'bouncing'; };

playBtn.onclick = async () => {
  const source = await setupAudio();
  source.start(0);
  draw();
  playBtn.disabled = true;
  stopPreviewBtn.disabled = false;
  statusBadge.textContent = 'Preview Playing';
  source.onended = stopPreview;
};

stopPreviewBtn.onclick = stopPreview;

function stopPreview() {
  if (audioSource) try { audioSource.stop(); } catch(e) {}
  cancelAnimationFrame(animationId);
  playBtn.disabled = false;
  stopPreviewBtn.disabled = true;
  statusBadge.textContent = 'Preview Stopped';
}

recordBtn.onclick = async () => {
  const source = await setupAudio();
  const dest = audioContext.createMediaStreamDestination();
  analyser.connect(dest);
  const canvasStream = canvas.captureStream(60);
  const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 12000000 }); // High bitrate
  recordedChunks = [];
  mediaRecorder.ondataavailable = (e) => recordedChunks.push(e.data);
  mediaRecorder.onstop = exportVideo;
  isRecording = true;
  recordingOverlay.style.display = 'flex';
  source.start(0);
  mediaRecorder.start();
  draw();
  source.onended = () => mediaRecorder.stop();
};

async function exportVideo() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const formData = new FormData();
  formData.append('video', blob);
  statusBadge.textContent = 'Final Encoding...';
  try {
    const res = await fetch('http://localhost:3001/api/encode', { method: 'POST', body: formData });
    if (res.ok) {
      const result = await res.blob();
      const url = URL.createObjectURL(result);
      const a = document.createElement('a'); a.href = url; a.download = 'ChombieWombie-Export.mp4'; a.click();
    }
  } catch (err) { console.error(err); }
  recordingOverlay.style.display = 'none';
  statusBadge.textContent = 'Export Complete';
}
