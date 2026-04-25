import './style.css'

// State management
let audioContext;
let analyser;
let source;
let dataArray;
let animationId;
let mediaRecorder;
let recordedChunks = [];
let audioFile;
let isRecording = false;
let brandImage = null;

// DOM Elements
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileBtn = document.getElementById('file-btn');
const playBtn = document.getElementById('play-btn');
const recordBtn = document.getElementById('record-btn');
const stopBtn = document.getElementById('stop-btn');
const statusBadge = document.getElementById('status');
const sensitivitySlider = document.getElementById('sensitivity');
const styleSelect = document.getElementById('style-select');
const palettes = document.querySelectorAll('.palette');
const recordingOverlay = document.getElementById('recording-overlay');

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

// Initialize Canvas Size
function resize() {
  canvas.width = canvas.offsetWidth * window.devicePixelRatio;
  canvas.height = canvas.offsetHeight * window.devicePixelRatio;
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
  statusBadge.textContent = 'Ready: ' + file.name;
}

// Branding Handling
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
  analyser.smoothingTimeConstant = 0.8;
  
  const buffer = await audioFile.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(buffer);
  
  const audioSource = audioContext.createBufferSource();
  audioSource.buffer = audioBuffer;
  audioSource.connect(analyser);
  analyser.connect(audioContext.destination);
  
  dataArray = new Uint8Array(analyser.frequencyBinCount);
  
  return audioSource;
}

// Visualizer Logic
function draw() {
  animationId = requestAnimationFrame(draw);
  analyser.getByteFrequencyData(dataArray);
  
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 4;
  const bars = analyser.frequencyBinCount;
  const sensitivity = config.sensitivity;

  if (config.style === 'circular') {
    drawCircular(centerX, centerY, radius, bars, sensitivity, 'out');
  } else if (config.style === 'circular-inner') {
    drawCircular(centerX, centerY, radius, bars, sensitivity, 'in');
  } else if (config.style === 'circular-dual') {
    drawCircular(centerX, centerY, radius, bars, sensitivity, 'dual');
  } else if (config.style === 'bars') {
    drawBars(width, height, bars, sensitivity);
  } else {
    drawWave(width, height, bars, sensitivity);
  }

  if (brandImage) {
    drawBranding(width, height);
  }
}

function drawCircular(cx, cy, r, bars, sens, dir) {
  for (let i = 0; i < bars; i++) {
    const barHeight = (dataArray[i] / 255) * r * (sens / 5);
    const angle = (i / bars) * Math.PI * 2;
    
    let x1, y1, x2, y2;
    
    if (dir === 'out') {
      x1 = cx + Math.cos(angle) * r;
      y1 = cy + Math.sin(angle) * r;
      x2 = cx + Math.cos(angle) * (r + barHeight);
      y2 = cy + Math.sin(angle) * (r + barHeight);
    } else if (dir === 'in') {
      x1 = cx + Math.cos(angle) * r;
      y1 = cy + Math.sin(angle) * r;
      x2 = cx + Math.cos(angle) * (r - barHeight);
      y2 = cy + Math.sin(angle) * (r - barHeight);
    } else { // Dual
      x1 = cx + Math.cos(angle) * (r - barHeight/2);
      y1 = cy + Math.sin(angle) * (r - barHeight/2);
      x2 = cx + Math.cos(angle) * (r + barHeight/2);
      y2 = cy + Math.sin(angle) * (r + barHeight/2);
    }
    
    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    gradient.addColorStop(0, config.colors[0]);
    gradient.addColorStop(1, config.colors[1]);
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = (r * 2 * Math.PI / bars) * 0.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    // Symmetrical
    const angleSym = -angle;
    let sx1, sy1, sx2, sy2;
    if (dir === 'out') {
      sx1 = cx + Math.cos(angleSym) * r; sy1 = cy + Math.sin(angleSym) * r;
      sx2 = cx + Math.cos(angleSym) * (r + barHeight); sy2 = cy + Math.sin(angleSym) * (r + barHeight);
    } else if (dir === 'in') {
      sx1 = cx + Math.cos(angleSym) * r; sy1 = cy + Math.sin(angleSym) * r;
      sx2 = cx + Math.cos(angleSym) * (r - barHeight); sy2 = cy + Math.sin(angleSym) * (r - barHeight);
    } else {
      sx1 = cx + Math.cos(angleSym) * (r - barHeight/2); sy1 = cy + Math.sin(angleSym) * (r - barHeight/2);
      sx2 = cx + Math.cos(angleSym) * (r + barHeight/2); sy2 = cy + Math.sin(angleSym) * (r + barHeight/2);
    }
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(sx2, sy2);
    ctx.stroke();
  }
}

function drawBranding(w, h) {
  const padding = 40;
  const scale = brandScale.value / 100;
  const brandW = brandImage.width * scale;
  const brandH = brandImage.height * scale;
  
  let bx, by;
  
  switch(brandPos.value) {
    case 'top-right': bx = w - brandW - padding; by = padding; break;
    case 'top-left': bx = padding; by = padding; break;
    case 'bottom-right': bx = w - brandW - padding; by = h - brandH - padding; break;
    case 'bottom-left': bx = padding; by = h - brandH - padding; break;
    case 'center': bx = (w - brandW) / 2; by = (h - brandH) / 2; break;
  }
  
  ctx.globalAlpha = 0.8;
  ctx.drawImage(brandImage, bx, by, brandW, brandH);
  ctx.globalAlpha = 1.0;
}

function drawBars(w, h, bars, sens) {
  const barWidth = (w / bars) * 2.5;
  let x = 0;
  for(let i = 0; i < bars; i++) {
    const barHeight = (dataArray[i] / 255) * h * 0.5 * (sens / 5);
    ctx.fillStyle = config.colors[i % 2 === 0 ? 0 : 1];
    ctx.fillRect(x, h - barHeight, barWidth, barHeight);
    x += barWidth + 1;
  }
}

function drawWave(w, h, bars, sens) {
  ctx.beginPath();
  ctx.lineWidth = 3;
  ctx.strokeStyle = config.colors[0];
  const sliceWidth = w / bars;
  let x = 0;
  for(let i = 0; i < bars; i++) {
    const v = dataArray[i] / 128.0;
    const y = v * h / 2;
    if(i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.lineTo(w, h / 2);
  ctx.stroke();
}

// Controls
sensitivitySlider.oninput = (e) => config.sensitivity = e.target.value;
styleSelect.onchange = (e) => config.style = e.target.value;
palettes.forEach(p => {
  p.onclick = () => {
    palettes.forEach(btn => btn.classList.remove('active'));
    p.classList.add('active');
    config.colors = p.dataset.colors.split(',');
  };
});

// Recording Logic
recordBtn.onclick = async () => {
  if (isRecording) return;
  
  const audioSource = await setupAudio();
  const dest = audioContext.createMediaStreamDestination();
  analyser.connect(dest);
  
  const canvasStream = canvas.captureStream(60);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ]);
  
  mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 8000000 // 8Mbps for higher quality
  });
  
  recordedChunks = [];
  mediaRecorder.ondataavailable = (e) => recordedChunks.push(e.data);
  mediaRecorder.onstop = exportVideo;
  
  isRecording = true;
  recordBtn.classList.add('active');
  recordingOverlay.style.display = 'flex';
  
  audioSource.start(0);
  mediaRecorder.start();
  draw();
  
  audioSource.onended = () => {
    if (isRecording) stopRecording();
  };
};

stopBtn.onclick = stopRecording;

function stopRecording() {
  mediaRecorder.stop();
  cancelAnimationFrame(animationId);
  isRecording = false;
  recordBtn.classList.remove('active');
}

async function exportVideo() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const formData = new FormData();
  formData.append('video', blob);
  
  statusBadge.textContent = 'Processing Video...';
  
  try {
    const response = await fetch('http://localhost:3001/api/encode', {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      const resultBlob = await response.blob();
      const url = URL.createObjectURL(resultBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chombiewombie-export.mp4';
      a.click();
      statusBadge.textContent = 'Download Complete!';
    } else {
      throw new Error('Encoding failed');
    }
  } catch (err) {
    console.error(err);
    statusBadge.textContent = 'Error: ' + err.message;
  } finally {
    recordingOverlay.style.display = 'none';
  }
}

// Play Preview Logic
playBtn.onclick = async () => {
  const audioSource = await setupAudio();
  audioSource.start(0);
  draw();
  statusBadge.textContent = 'Playing Preview';
  audioSource.onended = () => cancelAnimationFrame(animationId);
};
