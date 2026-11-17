// Exporta um vídeo da série para MP4 sem áudio (1080x1920, 30 fps) e grava a lista de sons.
// Uso: node render.js PASTA_DO_VIDEO SAIDA.mp4 SONS.json [t1 t2 ... para só capturar quadros]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const FPS = 30;
const [pasta, saida, sonsJson, ...quadros] = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  const rel = path.relative(__dirname, path.resolve(pasta));
  await page.goto('file://' + path.join(__dirname, 'player.html') + '?render=1&v=' + encodeURIComponent(rel));
  await page.evaluate(() => Promise.all([document.fonts.load('900 60px Inter'), document.fonts.load('60px "Noto Color Emoji"', '🙂')]));
  if (erros.length) { console.error('ERRO NA PÁGINA:', erros.join('\n')); process.exit(1); }
  const shot = t => page.evaluate(t => { window.render(t); return document.getElementById('c').toDataURL('image/jpeg', 0.92); }, t);

  if (quadros.length) {           // modo captura: salva JPEGs em SAIDA (pasta)
    fs.mkdirSync(saida, { recursive: true });
    for (const q of quadros) {
      const d = await shot(+q);
      fs.writeFileSync(path.join(saida, 'q_' + (+q).toFixed(2).padStart(6, '0') + '.jpg'), Buffer.from(d.split(',')[1], 'base64'));
    }
    if (erros.length) { console.error('ERRO NA PÁGINA:', erros.join('\n')); process.exit(1); }
    await browser.close(); return;
  }

  fs.writeFileSync(sonsJson, JSON.stringify(await page.evaluate(() => window.sons())));
  const duration = await page.evaluate(() => window.DURATION);
  const total = Math.round(duration * FPS);
  const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart', saida],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < total; i++) {
    const d = await shot(i / FPS);
    if (!ffmpeg.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => ffmpeg.stdin.once('drain', r));
  }
  ffmpeg.stdin.end();
  await new Promise(r => ffmpeg.on('close', r));
  await browser.close();
  if (erros.length) { console.error('ERRO NA PÁGINA:', erros.join('\n')); process.exit(1); }
  console.log(`vídeo: ${total} quadros`);
})();
