const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '500mb' }));

const upload = multer({ dest: 'temp/' });

// Job tracking
const activeJobs = {};

app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'ChombieWombie-Backend' });
});

app.post('/api/render-headless', upload.single('audio'), async (req, res) => {
  try {
    const { dataMap, config } = req.body;
    const audioMap = JSON.parse(dataMap);
    const renderConfig = JSON.parse(config);
    const audioPath = req.file.path;
    const jobId = `job-${Date.now()}`;
    const outputPath = path.join(__dirname, 'temp', `${jobId}.mp4`);

    activeJobs[jobId] = {
      status: 'starting',
      progress: 0,
      totalFrames: audioMap.length,
      outputPath: outputPath,
      tempAudio: audioPath
    };

    // Start background process without blocking
    renderInContext(jobId, audioMap, renderConfig, audioPath, outputPath).catch(err => {
      console.error(`Job ${jobId} failed:`, err);
      if (activeJobs[jobId]) {
        activeJobs[jobId].status = 'error';
        activeJobs[jobId].error = err.message;
      }
    });

    res.json({ jobId });
  } catch (err) {
    console.error('Error starting render:', err);
    res.status(500).send(err.message);
  }
});

async function renderInContext(jobId, audioMap, renderConfig, audioPath, outputPath) {
  const job = activeJobs[jobId];
  job.status = 'rendering';

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=metal']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto('http://localhost:5173/?headless=true');
    await page.waitForFunction(() => typeof window.renderFrame === 'function', { timeout: 10000 });

    const ffmpegProcess = ffmpeg()
      .input('pipe:0')
      .inputFPS(60)
      .inputFormat('image2pipe')
      .input(audioPath)
      .outputOptions([
        '-c:v libx264', '-preset fast', '-crf 18',
        '-c:a aac', '-b:a 320k', '-pix_fmt yuv420p', '-shortest'
      ])
      .on('error', (err) => {
        console.error('FFmpeg Error:', err);
        job.status = 'error';
        job.error = err.message;
      })
      .on('end', () => {
        console.log(`Job ${jobId} finished.`);
        job.status = 'done';
        job.progress = 100;
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      });

    const ffmpegStdin = ffmpegProcess.save(outputPath);

    for (let i = 0; i < audioMap.length; i++) {
      if (job.status === 'error') break;
      
      const frameTime = i / 60;
      const dataUrl = await page.evaluate(async (idx, data, cfg, time) => {
        return await window.renderFrame(idx, data, cfg, time);
      }, i, audioMap[i], renderConfig, frameTime);

      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
      ffmpegProcess.stdin.write(Buffer.from(base64Data, 'base64'));
      
      job.progress = Math.round((i / audioMap.length) * 100);
      if (i % 100 === 0) console.log(`Job ${jobId}: ${job.progress}%`);
    }

    ffmpegProcess.stdin.end();
  } catch (err) {
    console.error('Render Loop Error:', err);
    job.status = 'error';
    job.error = err.message;
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
