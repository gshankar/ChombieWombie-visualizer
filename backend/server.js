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
app.use(express.json({ limit: '500mb' })); // Increase limit for data maps

const upload = multer({ dest: 'temp/' });

app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'ChombieWombie-Backend' });
});

app.post('/api/render-headless', upload.single('audio'), async (req, res) => {
  const { dataMap, config } = req.body;
  const audioMap = JSON.parse(dataMap);
  const renderConfig = JSON.parse(config);
  const audioPath = req.file.path;
  const outputPath = path.join(__dirname, 'temp', `studio-render-${Date.now()}.mp4`);

  console.log(`Starting Studio Render: ${audioMap.length} frames...`);

  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=metal'] // Metal support for Mac Studio
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Load local frontend
    await page.goto('http://localhost:5173/?headless=true');
    await page.waitForFunction(() => typeof window.renderFrame === 'function');

    // Setup FFmpeg
    const ffmpegProcess = ffmpeg()
      .input('pipe:0')
      .inputFPS(60)
      .inputFormat('image2pipe')
      .input(audioPath)
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 18',
        '-c:a aac',
        '-b:a 320k',
        '-pix_fmt yuv420p',
        '-shortest'
      ])
      .on('error', (err) => console.error('FFmpeg Error:', err))
      .on('end', () => {
        console.log('FFmpeg finished.');
      });

    const stream = ffmpegProcess.pipe();
    stream.on('data', (chunk) => res.write(chunk));
    stream.on('end', () => res.end());

    // Render loop
    for (let i = 0; i < audioMap.length; i++) {
      const frameTime = i / 60;
      const dataUrl = await page.evaluate(async (idx, data, cfg, time) => {
        return await window.renderFrame(idx, data, cfg, time);
      }, i, audioMap[i], renderConfig, frameTime);

      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
      ffmpegProcess.stdin.write(Buffer.from(base64Data, 'base64'));

      if (i % 100 === 0) console.log(`Rendered frame ${i}/${audioMap.length}`);
    }

    ffmpegProcess.stdin.end();
    await browser.close();
    fs.unlinkSync(audioPath);

  } catch (err) {
    console.error('Render Error:', err);
    res.status(500).send(err.message);
  }
});

// Original real-time upload endpoint for compatibility
app.post('/api/encode', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).send('No video file uploaded.');
  const inputPath = req.file.path;
  const outputPath = path.join(__dirname, 'temp', `final-${Date.now()}.mp4`);
  ffmpeg(inputPath)
    .outputOptions(['-c:v libx264', '-preset fast', '-crf 22', '-c:a aac', '-b:a 192k', '-movflags +faststart'])
    .on('end', () => {
      res.download(outputPath, 'visualizer-export.mp4', () => {
        fs.unlinkSync(inputPath);
      });
    })
    .on('error', (err) => {
      res.status(500).send('Error during encoding: ' + err.message);
      fs.unlinkSync(inputPath);
    })
    .save(outputPath);
});

app.listen(port, () => {
  console.log(`ChombieWombie Studio Backend listening at http://localhost:${port}`);
});
