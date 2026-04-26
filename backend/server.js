const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { PassThrough } = require('stream');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '500mb' }));

const upload = multer({ 
  dest: 'temp/',
  limits: { fieldSize: 500 * 1024 * 1024 } // 500MB
});

// Job tracking
const activeJobs = {};

app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'ChombieWombie-Backend' });
});

app.post('/api/render-headless', upload.fields([{ name: 'audio' }, { name: 'dataMap' }]), async (req, res) => {
  try {
    const audioFile = req.files.audio[0];
    const dataMapFile = req.files.dataMap[0];
    const { config, numBins } = req.body;
    
    const renderConfig = JSON.parse(config);
    const bins = parseInt(numBins);
    const audioPath = audioFile.path;
    
    // Read the binary data map
    const dataMapBuffer = fs.readFileSync(dataMapFile.path);
    const totalFrames = dataMapBuffer.length / bins;
    
    const jobId = `job-${Date.now()}`;
    const outputPath = path.join(__dirname, 'temp', `${jobId}.mp4`);

    activeJobs[jobId] = {
      status: 'starting',
      progress: 0,
      totalFrames: totalFrames,
      outputPath: outputPath,
      tempAudio: audioPath,
      tempDataMap: dataMapFile.path
    };

    // Helper to get frame data from buffer
    const getFrameData = (idx) => {
      const start = idx * bins;
      return Array.from(dataMapBuffer.slice(start, start + bins));
    };

    // Start background process without blocking
    renderInContext(jobId, getFrameData, totalFrames, renderConfig, audioPath, outputPath).catch(err => {
      console.error(`Job ${jobId} failed:`, err);
      if (activeJobs[jobId]) {
        activeJobs[jobId].status = 'error';
        activeJobs[jobId].error = err.message;
      }
    }).finally(() => {
      if (fs.existsSync(dataMapFile.path)) fs.unlinkSync(dataMapFile.path);
    });

    res.json({ jobId });
  } catch (err) {
    console.error('Error starting render:', err);
    res.status(500).send(err.message);
  }
});

async function renderInContext(jobId, getFrameData, totalFrames, renderConfig, audioPath, outputPath) {
  const job = activeJobs[jobId];
  job.status = 'rendering';

  const numWorkers = 8; // Optimized for stability and high performance
  const chunkSize = Math.ceil(totalFrames / numWorkers);
  const chunkPromises = [];

  console.log(`Job ${jobId}: Splitting into ${numWorkers} parallel chunks of ~${chunkSize} frames each.`);

  for (let i = 0; i < numWorkers; i++) {
    const startFrame = i * chunkSize;
    const endFrame = Math.min(startFrame + chunkSize, totalFrames);
    if (startFrame >= totalFrames) break;

    const chunkPath = path.join(__dirname, 'temp', `${jobId}_part${i}.ts`);
    chunkPromises.push(renderChunk(jobId, i, startFrame, endFrame, getFrameData, renderConfig, chunkPath));
  }

  try {
    const chunkPaths = await Promise.all(chunkPromises);
    job.status = 'finalizing';
    console.log(`Job ${jobId}: All chunks rendered. Merging and adding audio...`);

    // Create a concat file for ffmpeg
    const listPath = path.join(__dirname, 'temp', `${jobId}_list.txt`);
    const listContent = chunkPaths.map(p => `file '${path.basename(p)}'`).join('\n');
    fs.writeFileSync(listPath, listContent);

    // Merge chunks and add audio
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(['-f concat', '-safe 0'])
        .input(audioPath)
        .outputOptions([
          '-c:v copy', // No re-encoding needed for video!
          '-c:a aac', '-b:a 320k', '-pix_fmt yuv420p', '-shortest'
        ])
        .on('error', reject)
        .on('end', resolve)
        .save(outputPath);
    });

    console.log(`Job ${jobId} finished.`);
    job.status = 'done';
    job.progress = 100;

    // Cleanup temp files
    [listPath, ...chunkPaths, audioPath].forEach(p => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });

  } catch (err) {
    console.error('Multi-Thread Render Error:', err);
    job.status = 'error';
    job.error = err.message;
  }
}

async function renderChunk(jobId, workerIdx, startFrame, endFrame, getFrameData, renderConfig, chunkPath) {
  const job = activeJobs[jobId];
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=metal']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    page.setDefaultNavigationTimeout(60000);
    
    await page.goto('http://localhost:5173/?headless=true');
    await page.waitForFunction(() => typeof window.renderFrame === 'function', { timeout: 20000 });

    const videoStream = new PassThrough();
    const ffmpegProcess = ffmpeg()
      .input(videoStream)
      .inputFPS(60)
      .inputFormat('image2pipe')
      .outputOptions(['-c:v libx264', '-preset fast', '-crf 18', '-pix_fmt yuv420p'])
      .on('error', (err) => console.error(`Worker ${workerIdx} Error:`, err))
      .save(chunkPath);

    const totalInChunk = endFrame - startFrame;
    for (let i = startFrame; i < endFrame; i++) {
      if (job.status === 'error') break;
      
      const frameTime = i / 60;
      const dataUrl = await page.evaluate(async (idx, data, cfg, time) => {
        return await window.renderFrame(idx, data, cfg, time);
      }, i, getFrameData(i), renderConfig, frameTime);

      const base64Data = dataUrl.split(',')[1];
      videoStream.write(Buffer.from(base64Data, 'base64'));
      
      if (i % 100 === 0) {
        // We calculate global progress based on all workers
        // This is a rough estimation since we don't track each worker perfectly here
      }
    }

    videoStream.end();
    
    // Wait for FFmpeg to finish the chunk
    await new Promise((resolve) => {
      ffmpegProcess.on('end', resolve);
      ffmpegProcess.on('error', resolve); // Still resolve to let the main process handle it
    });

    return chunkPath;
  } finally {
    if (browser) await browser.close();
  }
}

app.get('/api/render-status/:jobId', (req, res) => {
  const job = activeJobs[req.params.jobId];
  if (!job) return res.status(404).json({ status: 'not_found' });
  res.json({ status: job.status, progress: job.progress, error: job.error });
});

app.get('/api/render-download/:jobId', (req, res) => {
  const job = activeJobs[req.params.jobId];
  if (!job || job.status !== 'done') return res.status(400).send('File not ready');
  res.download(job.outputPath, 'ChombieWombie-Studio-Render.mp4');
});

app.post('/api/reset', (req, res) => {
  console.log('Resetting Studio Engine...');
  // Clear jobs
  Object.keys(activeJobs).forEach(id => delete activeJobs[id]);
  // Clear temp folder
  const tempDir = path.join(__dirname, 'temp');
  if (fs.existsSync(tempDir)) {
    fs.readdirSync(tempDir).forEach(f => fs.unlinkSync(path.join(tempDir, f)));
  }
  res.json({ status: 'ok', message: 'Studio Engine Reset Successful' });
});

// Real-time fallback
app.post('/api/encode', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).send('No video file uploaded.');
  const inputPath = req.file.path;
  const outputPath = path.join(__dirname, 'temp', `final-${Date.now()}.mp4`);
  ffmpeg(inputPath)
    .outputOptions(['-c:v libx264', '-preset fast', '-crf 22', '-c:a aac', '-b:a 192k', '-movflags +faststart'])
    .on('end', () => {
      res.download(outputPath, 'visualizer-export.mp4', () => {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      });
    })
    .on('error', (err) => {
      res.status(500).send('Error during encoding: ' + err.message);
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    })
    .save(outputPath);
});

app.listen(port, () => {
  console.log(`ChombieWombie Studio Backend listening at http://localhost:${port}`);
});
