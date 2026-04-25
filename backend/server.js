const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Setup storage for recorded blobs
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `recorded-${Date.now()}.webm`);
  }
});

const upload = multer({ storage: storage });

app.post('/api/encode', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No video file uploaded.');
  }

  const inputPath = req.file.path;
  const outputPath = path.join(__dirname, 'temp', `final-${Date.now()}.mp4`);

  console.log('Encoding started...', inputPath);

  ffmpeg(inputPath)
    .outputOptions([
      '-c:v libx264',
      '-preset fast',
      '-crf 22',
      '-c:a aac',
      '-b:a 192k',
      '-movflags +faststart'
    ])
    .on('end', () => {
      console.log('Encoding finished:', outputPath);
      res.download(outputPath, 'visualizer-export.mp4', (err) => {
        if (err) console.error('Download error:', err);
        // Clean up
        fs.unlinkSync(inputPath);
        // Optionally delete outputPath after download or on a timer
      });
    })
    .on('error', (err) => {
      console.error('FFmpeg error:', err);
      res.status(500).send('Error during encoding: ' + err.message);
      fs.unlinkSync(inputPath);
    })
    .save(outputPath);
});

// Static folder for exports if needed
app.use('/exports', express.static(path.join(__dirname, 'temp')));

app.listen(port, () => {
  console.log(`ChombieWombie Backend listening at http://localhost:${port}`);
});
