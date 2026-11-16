// Exporta a animação de index.html para MP4 (1080x1920, 30 fps).
// Uso: node render.js [saida.mp4]
// Requer: playwright (com Chromium) e ffmpeg no PATH.

const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const FPS = 30;
const out = process.argv[2] || path.join(__dirname, 'dinheiro-virtual.mp4');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + path.join(__dirname, 'index.html') + '?render=1');
  await page.evaluate(() => document.fonts.load('900 60px Inter').then(() => document.fonts.ready));
  const duration = await page.evaluate(() => window.DURATION);
  const total = Math.round(duration * FPS);

  // Faixa de áudio silenciosa: algumas plataformas rejeitam vídeo sem áudio.
  const ffmpeg = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
    '-c:a', 'aac', '-shortest', '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  for (let i = 0; i < total; i++) {
    const data = await page.evaluate(t => {
      window.render(t);
      return document.getElementById('c').toDataURL('image/jpeg', 0.95);
    }, i / FPS);
    const buf = Buffer.from(data.split(',')[1], 'base64');
    if (!ffmpeg.stdin.write(buf)) await new Promise(r => ffmpeg.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`quadro ${i}/${total}`);
  }
  ffmpeg.stdin.end();
  await new Promise(r => ffmpeg.on('close', r));
  await browser.close();
  console.log('pronto:', out);
})();
