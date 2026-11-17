// Motor de animação da série. Desenha um vídeo vertical (1080x1920) em canvas
// a partir de window.ROTEIRO (cenas e elementos) e window.TEMPOS (gerado por narrar.py).
// render(t) é determinístico: o mesmo t sempre gera o mesmo quadro.
//
// Tempos dos elementos ("t", "sai", "festa", move[].t ...):
//   número  -> segundos a partir do início da cena
//   "n:f"   -> fala n (contando de 1) na fração f da sua duração; aceita "+0.3" no fim
(function () {
  const W = 1080, H = 1920, GROUND = 1290;
  const RT = window.ROTEIRO, TP = window.TEMPOS;
  const DURATION = TP.duracao;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const FONT = '"Inter", "DejaVu Sans", Arial, sans-serif';
  const EMOJI = '"Noto Color Emoji"';

  const PALETA = {
    azul: '#3b82f6', verde: '#22c55e', amarelo: '#eab308', laranja: '#fb923c', vermelho: '#ef4444',
    roxo: '#a855f7', rosa: '#ec4899', cinza: '#64748b', ouro: '#f5b301', ciano: '#38bdf8',
    branco: '#ffffff', tinta: '#0b1020', nota: '#2fa866', marrom: '#8a5a35', claro: '#e2e8f0',
  };
  const CLAROS = new Set(['ouro', 'amarelo', 'branco', 'ciano', 'claro']);
  const cor = c => PALETA[c] || c || '#ffffff';
  const corTexto = c => (CLAROS.has(c) ? PALETA.tinta : '#ffffff');

  // ---------- utilidades ----------
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  const easeInOut = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const easeBack = k => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  const pop = (t, start, dur = 0.35) => { const k = prog(t, start, start + dur); return k <= 0 ? 0 : easeBack(k); };
  const rand = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const fmt = (v, casas = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function text(str, x, y, size, color, opts = {}) {
    ctx.save();
    ctx.font = `${opts.weight || 800} ${size}px ${FONT}`;
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = 'middle';
    if (opts.stroke) { ctx.lineWidth = opts.strokeWidth || 10; ctx.strokeStyle = opts.stroke; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
    ctx.restore();
  }
  function largura(str, size, weight = 900) {
    ctx.save(); ctx.font = `${weight} ${size}px ${FONT}`; const w = ctx.measureText(str).width; ctx.restore(); return w;
  }
  function wrapLines(str, size, maxW, weight = 800) {
    const lines = []; let line = '';
    for (const word of String(str).split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (largura(test, size, weight) > maxW && line) { lines.push(line); line = word; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }
  function scaled(x, y, s, fn) {
    if (s <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-x, -y); fn(); ctx.restore();
  }

  // ---------- tempo ----------
  function T(ref, ci) {
    if (ref == null) return null;
    if (typeof ref === 'number') return TP.cenas[ci] + ref;
    const m = /^(\d+):(-?[\d.]+)([+-][\d.]+)?$/.exec(String(ref));
    if (!m) throw new Error('tempo inválido: ' + ref);
    const f = TP.falas[+m[1] - 1];
    if (!f) throw new Error('fala inexistente: ' + ref);
    return f.s + (f.e - f.s) * +m[2] + (m[3] ? +m[3] : 0);
  }

  // ---------- cenários ----------
  function bgEscuro(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a1230'); g.addColorStop(0.55, '#101d4a'); g.addColorStop(1, '#070b1e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const r = ctx.createRadialGradient(W / 2, 820, 50, W / 2, 820, 900);
    r.addColorStop(0, 'rgba(80,120,255,0.22)'); r.addColorStop(1, 'rgba(80,120,255,0)');
    ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const x = rand(i) * W + Math.sin(t * 0.4 + i) * 14;
      const y = ((rand(i + 100) * H - t * (12 + rand(i + 200) * 30)) % H + H) % H;
      const a = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.5 + i * 2.1));
      ctx.fillStyle = `rgba(170,200,255,${a})`;
      ctx.beginPath(); ctx.arc(x, y, 1.5 + rand(i + 300) * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save(); ctx.globalAlpha = 0.10; ctx.strokeStyle = '#9cc0ff'; ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const y = ((rand(i + 500) * H + t * 40) % H), x = rand(i + 600) * W;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 160, y - 60); ctx.stroke();
    }
    ctx.restore();
  }
  function nuvem(x, y, s) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 46 * s, 0, 7); ctx.arc(x + 55 * s, y - 22 * s, 58 * s, 0, 7);
    ctx.arc(x + 120 * s, y, 48 * s, 0, 7); ctx.arc(x + 60 * s, y + 14 * s, 52 * s, 0, 7);
    ctx.fill();
  }
  function ceu(t) {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, '#6ec3ff'); g.addColorStop(1, '#d6f0ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(900, 640); ctx.rotate(t * 0.25);
    ctx.strokeStyle = 'rgba(255,214,64,0.75)'; ctx.lineWidth = 12; ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(88, 0); ctx.lineTo(118, 0); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#ffd640'; ctx.beginPath(); ctx.arc(900, 640, 70, 0, 7); ctx.fill();
    nuvem(((120 + t * 14) % (W + 300)) - 150, 610, 0.9);
    nuvem(((620 + t * 9) % (W + 300)) - 150, 720, 0.7);
  }
  function bgClaro(t) {
    ceu(t);
    ctx.fillStyle = '#7ccf6b';
    ctx.beginPath(); ctx.ellipse(250, GROUND + 40, 520, 200, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(900, GROUND + 60, 560, 230, 0, 0, 7); ctx.fill();
    const gg = ctx.createLinearGradient(0, GROUND, 0, H);
    gg.addColorStop(0, '#56b947'); gg.addColorStop(1, '#2f8a2c');
    ctx.fillStyle = gg; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#b07a43';
    ctx.fillRect(0, GROUND - 62, W, 12); ctx.fillRect(0, GROUND - 30, W, 12);
    for (let x = 30; x < W; x += 90) {
      ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x, GROUND - 84); ctx.lineTo(x + 11, GROUND - 98); ctx.lineTo(x + 22, GROUND - 84); ctx.lineTo(x + 22, GROUND); ctx.fill();
    }
  }
  function bgCidade(t) {
    ceu(t);
    const cores = ['#94a3c4', '#a5b4d4', '#8796b8', '#b3c0dc'];
    let x = -30;
    for (let i = 0; x < W; i++) {
      const w = 120 + rand(i + 40) * 110, h = 260 + rand(i + 80) * 420;
      ctx.fillStyle = cores[i % 4]; ctx.fillRect(x, GROUND - h, w - 8, h);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      for (let wy = GROUND - h + 30; wy < GROUND - 40; wy += 56)
        for (let wx = x + 18; wx < x + w - 40; wx += 42) if (rand(wx * 3 + wy) > 0.3) ctx.fillRect(wx, wy, 22, 30);
      x += w;
    }
    ctx.fillStyle = '#9aa3b2'; ctx.fillRect(0, GROUND, W, 70);
    ctx.fillStyle = '#4b5563'; ctx.fillRect(0, GROUND + 70, W, H - GROUND - 70);
    ctx.fillStyle = '#f8fafc';
    for (let sx = ((-t * 60) % 160 + 160) % 160 - 160; sx < W; sx += 160) ctx.fillRect(sx, GROUND + 230, 80, 12);
  }
  const FUNDOS = { escuro: bgEscuro, claro: bgClaro, cidade: bgCidade };

  // ---------- objetos ----------
  function nota(cx, cy, w, label) {
    const h = w * 0.5;
    rr(cx - w / 2, cy - h / 2, w, h, w * 0.06); ctx.fillStyle = PALETA.nota; ctx.fill();
    ctx.lineWidth = w * 0.025; ctx.strokeStyle = '#1c7a47'; ctx.stroke();
    rr(cx - w / 2 + w * 0.06, cy - h / 2 + w * 0.06, w * 0.88, h - w * 0.12, w * 0.03);
    ctx.lineWidth = w * 0.012; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
    const size = Math.min(w * 0.2, (w * 0.8) / Math.max(1, String(label).length) * 1.7);
    text(label, cx, cy + 2, size, '#ffffff', { weight: 900 });
  }
  function moeda(cx, cy, r) {
    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, '#ffe08a'); g.addColorStop(0.55, '#f5b301'); g.addColorStop(1, '#b97a00');
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = r * 0.14; ctx.strokeStyle = '#8a5a00'; ctx.stroke();
    text('$', cx, cy + r * 0.06, r * 1.2, '#8a5a00', { weight: 900 });
  }
  function ouro(cx, cy, w) {
    const h = w * 0.42, top = w * 0.72;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy + h / 2); ctx.lineTo(cx - top / 2, cy - h / 2);
    ctx.lineTo(cx + top / 2, cy - h / 2); ctx.lineTo(cx + w / 2, cy + h / 2); ctx.closePath();
    const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
    g.addColorStop(0, '#ffe08a'); g.addColorStop(0.5, '#f5b301'); g.addColorStop(1, '#b97a00');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(2, w * 0.035); ctx.strokeStyle = '#8a5a00'; ctx.lineJoin = 'round'; ctx.stroke();
  }
  // Boneco-palito. (x, y) = ponto entre os pés. arms: 0 = baixos, 1 = levantados.
  function boneco(x, y, s, color, num, arms, opts = {}) {
    const jump = arms * Math.abs(Math.sin((opts.t || 0) * 7)) * 22 * s;
    y -= jump;
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round'; ctx.lineWidth = 16 * s;
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(x, y + jump + 6 * s, 70 * s, 14 * s, 0, 0, 7); ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(x - 20 * s, y - 105 * s); ctx.lineTo(x - 32 * s, y);
    ctx.moveTo(x + 20 * s, y - 105 * s); ctx.lineTo(x + 32 * s, y); ctx.stroke();
    const ang = lerp(1.15, -1.0, arms);
    const len = 88 * s, sy = y - 195 * s;
    const lArm = opts.leftArm ?? ang, rArm = opts.rightArm ?? ang;
    ctx.beginPath();
    ctx.moveTo(x - 40 * s, sy); ctx.lineTo(x - 40 * s - Math.cos(lArm) * len, sy + Math.sin(lArm) * len);
    ctx.moveTo(x + 40 * s, sy); ctx.lineTo(x + 40 * s + Math.cos(rArm) * len, sy + Math.sin(rArm) * len);
    ctx.stroke();
    rr(x - 44 * s, y - 218 * s, 88 * s, 122 * s, 22 * s); ctx.fill();
    if (num != null && num !== '') text(String(num), x, y - 155 * s, (String(num).length > 1 ? 48 : 64) * s, '#ffffff', { weight: 900 });
    ctx.beginPath(); ctx.arc(x, y - 262 * s, 40 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#ffffff';
    const look = opts.lookUp ? -8 * s : 0;
    ctx.beginPath(); ctx.arc(x - 14 * s, y - 268 * s + look, 7 * s, 0, 7); ctx.arc(x + 14 * s, y - 268 * s + look, 7 * s, 0, 7); ctx.fill();
    if (opts.boca) {
      ctx.lineWidth = 5 * s; ctx.beginPath();
      if (opts.boca === 'feliz') ctx.arc(x, y - 252 * s, 14 * s, 0.15 * Math.PI, 0.85 * Math.PI);
      else ctx.arc(x, y - 236 * s, 14 * s, 1.2 * Math.PI, 1.8 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();
    return { hx: x + 40 * s + Math.cos(rArm) * len, hy: sy + Math.sin(rArm) * len, top: y - 302 * s };
  }
  function predio(x, y, s, label, governo, t) {
    const w = 430 * s, h = 330 * s;
    ctx.save();
    ctx.fillStyle = '#f4f1ea'; ctx.strokeStyle = '#9a927f'; ctx.lineWidth = 5 * s; ctx.lineJoin = 'round';
    ctx.fillRect(x - w / 2, y - h, w, h); ctx.strokeRect(x - w / 2, y - h, w, h);
    ctx.beginPath(); ctx.moveTo(x - w / 2 - 26 * s, y - h); ctx.lineTo(x, y - h - 150 * s); ctx.lineTo(x + w / 2 + 26 * s, y - h); ctx.closePath();
    ctx.fillStyle = '#e7e2d6'; ctx.fill(); ctx.stroke();
    text(label, x, y - h - 50 * s, Math.min(46, 260 / Math.max(1, label.length) * 1.6) * s, '#6b6455', { weight: 900 });
    ctx.fillStyle = '#dcd6c8';
    const cols = governo ? [-170, -85, 85, 170] : [-170, 170];
    for (const cx of cols) { ctx.fillRect(x + cx * s - 20 * s, y - h + 12 * s, 40 * s, h - 12 * s); ctx.strokeRect(x + cx * s - 20 * s, y - h + 12 * s, 40 * s, h - 12 * s); }
    if (governo) {
      rr(x - 42 * s, y - 190 * s, 84 * s, 190 * s, 40 * s); ctx.fillStyle = '#3d4a66'; ctx.fill();
      ctx.strokeStyle = '#7a7466'; ctx.lineWidth = 8 * s;
      ctx.beginPath(); ctx.moveTo(x, y - h - 150 * s); ctx.lineTo(x, y - h - 300 * s); ctx.stroke();
      const wave = Math.sin((t || 0) * 3) * 6 * s;
      ctx.fillStyle = '#1f9d4d';
      ctx.beginPath(); ctx.moveTo(x, y - h - 300 * s); ctx.lineTo(x + 130 * s, y - h - 294 * s + wave); ctx.lineTo(x + 130 * s, y - h - 214 * s + wave); ctx.lineTo(x, y - h - 220 * s); ctx.fill();
      ctx.fillStyle = '#ffd640';
      ctx.beginPath(); ctx.moveTo(x + 18 * s, y - h - 258 * s + wave * 0.3); ctx.lineTo(x + 65 * s, y - h - 284 * s + wave * 0.5); ctx.lineTo(x + 112 * s, y - h - 255 * s + wave); ctx.lineTo(x + 65 * s, y - h - 228 * s + wave * 0.5); ctx.fill();
      ctx.fillStyle = '#2d5fd0'; ctx.beginPath(); ctx.arc(x + 65 * s, y - h - 256 * s + wave * 0.5, 15 * s, 0, 7); ctx.fill();
    } else {
      const vw = 230 * s, vh = 240 * s, vx = x - vw / 2, vy = y - vh - 20 * s;
      rr(vx, vy, vw, vh, 16 * s); ctx.fillStyle = '#8b93a7'; ctx.fill(); ctx.strokeStyle = '#5c6478'; ctx.lineWidth = 6 * s; ctx.stroke();
      ctx.lineWidth = 8 * s;
      ctx.beginPath(); ctx.arc(x, vy + vh / 2, 54 * s, 0, 7); ctx.stroke();
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; ctx.beginPath(); ctx.moveTo(x, vy + vh / 2); ctx.lineTo(x + Math.cos(a) * 80 * s, vy + vh / 2 + Math.sin(a) * 80 * s); ctx.stroke(); }
    }
    ctx.restore();
  }
  function casa(x, y, s) {
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = 5 * s; ctx.strokeStyle = '#8a6a4a';
    ctx.fillStyle = '#fff3d6'; ctx.fillRect(x - 120 * s, y - 190 * s, 240 * s, 190 * s); ctx.strokeRect(x - 120 * s, y - 190 * s, 240 * s, 190 * s);
    ctx.beginPath(); ctx.moveTo(x - 150 * s, y - 190 * s); ctx.lineTo(x, y - 320 * s); ctx.lineTo(x + 150 * s, y - 190 * s); ctx.closePath();
    ctx.fillStyle = '#d9483b'; ctx.fill(); ctx.strokeStyle = '#9c2f25'; ctx.stroke();
    ctx.fillStyle = '#8a5a35'; ctx.fillRect(x - 85 * s, y - 110 * s, 60 * s, 110 * s);
    ctx.fillStyle = '#8fd3ff'; ctx.strokeStyle = '#8a6a4a';
    ctx.fillRect(x + 15 * s, y - 130 * s, 70 * s, 62 * s); ctx.strokeRect(x + 15 * s, y - 130 * s, 70 * s, 62 * s);
    ctx.restore();
  }
  function escudo(txt) {
    ctx.beginPath();
    ctx.moveTo(0, -170); ctx.lineTo(140, -120); ctx.lineTo(140, 10);
    ctx.quadraticCurveTo(130, 130, 0, 190); ctx.quadraticCurveTo(-130, 130, -140, 10); ctx.lineTo(-140, -120); ctx.closePath();
    const g = ctx.createLinearGradient(0, -170, 0, 190);
    g.addColorStop(0, '#4f9bff'); g.addColorStop(1, '#1d4ed8');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 12; ctx.strokeStyle = '#ffffff'; ctx.lineJoin = 'round'; ctx.stroke();
    text(txt, 0, -6, Math.min(92, 200 / Math.max(1, txt.length) * 1.6), '#ffffff', { weight: 900 });
  }
  function selo(str, size, bg, fg, borda = 6) {
    const w = largura(str, size) + size * 1.3, h = size * 1.75;
    rr(-w / 2, -h / 2, w, h, h / 2);
    ctx.fillStyle = bg; ctx.fill();
    ctx.lineWidth = borda; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
    text(str, 0, 2, size, fg, { weight: 900 });
  }
  function circulo(r, c, n) {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fillStyle = c; ctx.fill();
    ctx.lineWidth = r * 0.13; ctx.strokeStyle = '#fff'; ctx.stroke();
    text(String(n), 0, r * 0.06, r * (String(n).length > 1 ? 0.9 : 1.2), '#ffffff', { weight: 900 });
  }
  function emoji(e, tam) {
    // fillStyle opaco: o Chromium aplica a transparência da cor atual ao emoji colorido
    ctx.save(); ctx.fillStyle = '#000'; ctx.font = `${tam}px ${EMOJI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(e, 0, tam * 0.06); ctx.restore();
  }
  function objetoMao(obj, x, y) {
    if (!obj) return;
    if (obj === 'nota') nota(x + 50, y - 55, 200, 'R$ 100');
    else if (obj === 'moeda') moeda(x + 25, y - 30, 32);
    else { ctx.save(); ctx.translate(x + 30, y - 40); emoji(obj, 110); ctx.restore(); }
  }

  // ---------- tipos de elemento ----------
  // Cada função desenha em torno da origem (0, 0) já posicionada e escalada.
  const TIPOS = {
    texto(el) {
      const lines = String(el.txt).split('\n'), maxW = el.maxW || (el.alinha === 'left' ? 1040 - (el.x ?? 540) : el.alinha === 'right' ? (el.x ?? 540) - 40 : 1000);
      let tam = el.tam || 96;
      const maior = Math.max(...lines.map(l => largura(l, tam, el.peso || 900)));
      if (maior > maxW) tam *= maxW / maior;
      const lh = tam * 1.12;
      lines.forEach((l, i) => text(l, 0, (i - (lines.length - 1) / 2) * lh, tam, cor((el.cores && el.cores[i]) || el.cor || 'branco'),
        { weight: el.peso || 900, align: el.alinha, stroke: el.contorno ? PALETA.tinta : null, strokeWidth: tam * 0.17 }));
    },
    // texto branco por padrão (padrão visual da série); escuro só em selos brancos
    selo(el) { const c = el.cor || 'ouro'; selo(String(el.txt), el.tam || 54, cor(c), el.corTxt ? cor(el.corTxt) : (c === 'branco' || c === 'claro' ? PALETA.tinta : '#ffffff'), el.borda ?? 6); },
    etiqueta(el) { selo(String(el.txt), el.tam || 36, el.cor ? cor(el.cor) : 'rgba(11,16,32,0.88)', '#ffffff', 4); },
    boneco(el, t, ci) {
      let arms = 0;
      if (el.festa != null) {
        const tf = T(el.festa, ci); arms = easeOut(prog(t, tf, tf + 0.3));
        if (el.festaAte != null) { const ta = T(el.festaAte, ci); arms *= 1 - prog(t, ta, ta + 0.3); }
      }
      const segura = el.segura && !(el.solta != null && t >= T(el.solta, ci));
      const rightArm = arms > 0.02 ? undefined : (segura || el.aponta ? -0.5 : undefined);
      const r = boneco(0, 0, 1, cor(el.cor || 'azul'), el.num, arms, { t, lookUp: el.olhar, rightArm, boca: el.boca });
      if (segura && arms <= 0.02) objetoMao(el.segura, r.hx, r.hy);
      if (el.rotulo) { ctx.save(); ctx.translate(0, r.top - 46); selo(el.rotulo, 36, el.corRotulo ? cor(el.corRotulo) : 'rgba(11,16,32,0.88)', '#fff', 4); ctx.restore(); }
    },
    nota(el) { nota(0, 0, el.w || 240, el.txt || 'R$ 100'); },
    moeda(el) { moeda(0, 0, el.r || 34); },
    moedas(el, t, ci) {
      const n = el.n || 3, r = el.r || 32, t0 = T(el.t ?? 0, ci);
      for (let i = 0; i < n; i++) { const k = pop(t, t0 + i * 0.08, 0.25); if (k > 0) scaled((i - (n - 1) / 2) * r * 1.9, 0, k, () => moeda((i - (n - 1) / 2) * r * 1.9, 0, r)); }
    },
    ouro(el) { ouro(0, 0, el.w || 220); },
    predio(el, t) { predio(0, 0, 1, el.txt || 'BANCO', el.governo, t); },
    casa() { casa(0, 0, 1); },
    escudo(el) { escudo(el.txt || 'FGC'); },
    emoji(el) { emoji(el.e, el.tam || 160); },
    circulo(el) { circulo(el.r || 58, cor(el.cor || 'azul'), el.num ?? ''); },
    caixa(el) {
      const w = el.w || 980, h = el.h || 200;
      rr(-w / 2, -h / 2, w, h, el.raio ?? 34); ctx.fillStyle = el.cor ? cor(el.cor) : 'rgba(255,255,255,0.08)'; ctx.fill();
      if (el.borda) { ctx.lineWidth = 6; ctx.strokeStyle = cor(el.borda); ctx.stroke(); }
    },
    forma(el) {
      ctx.beginPath();
      const w = el.w || 200, h = el.h || 200;
      if (el.forma === 'triangulo') { ctx.moveTo(0, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2, h / 2); ctx.closePath(); }
      else if (el.forma === 'retangulo') ctx.roundRect(-w / 2, -h / 2, w, h, el.raio ?? 16);
      else ctx.arc(0, 0, w / 2, 0, 7);
      ctx.fillStyle = cor(el.cor || 'branco'); ctx.fill();
      if (el.borda) { ctx.lineWidth = el.larg || 6; ctx.strokeStyle = cor(el.borda); ctx.stroke(); }
    },
    carimbo(el) {
      const tam = el.tam || 62, w = largura(el.txt, tam) + tam * 1.1, h = tam * 1.5, c = cor(el.cor || 'verde');
      ctx.rotate(el.inclina ?? -0.14);
      rr(-w / 2, -h / 2, w, h, 16); ctx.fillStyle = 'rgba(11,16,32,0.55)'; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = c; ctx.stroke();
      text(el.txt, 0, 3, tam, c, { weight: 900 });
    },
    xis(el) {
      const r = el.r || 50; ctx.strokeStyle = PALETA.vermelho; ctx.lineWidth = r * 0.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(r, -r); ctx.lineTo(-r, r); ctx.stroke();
    },
    ok(el) {
      const r = el.r || 50; ctx.strokeStyle = PALETA.verde; ctx.lineWidth = r * 0.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(-r * 0.25, r * 0.7); ctx.lineTo(r, -r * 0.7); ctx.stroke();
    },
    balao(el) {
      const tam = el.tam || 46, lines = wrapLines(el.txt, tam, el.w || 520, 800), lh = tam * 1.2;
      const w = Math.max(...lines.map(l => largura(l, tam, 800))) + 70, h = lines.length * lh + 50;
      rr(-w / 2, -h / 2, w, h, 30); ctx.fillStyle = '#ffffff'; ctx.fill();
      const lado = el.lado === 'direita' ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(lado * w * 0.18, h / 2 - 2); ctx.lineTo(lado * w * 0.32, h / 2 + 46); ctx.lineTo(lado * w * 0.02, h / 2 - 2); ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(11,16,32,0.25)'; rr(-w / 2, -h / 2, w, h, 30); ctx.stroke();
      lines.forEach((l, i) => text(l, 0, (i - (lines.length - 1) / 2) * lh + 2, tam, PALETA.tinta, { weight: 800 }));
    },
    contador(el, t, ci) {
      const t0 = T(el.t ?? 0, ci), k = easeInOut(prog(t, t0, t0 + (el.dur || 1.5)));
      const v = el.exp ? el.de * Math.pow(el.para / el.de, k) : lerp(el.de ?? 0, el.para, k);
      const s = (el.pre || '') + fmt(k >= 1 ? el.para : v, el.casas || 0) + (el.suf || '');
      text(s, 0, 0, el.tam || 110, cor(el.cor || 'ouro'), { weight: 900, stroke: el.contorno ? PALETA.tinta : null, strokeWidth: (el.tam || 110) * 0.15 });
    },
    conta(el, t, ci) {
      const tam = el.tam || 64, lh = tam * 1.35, n = el.linhas.length, t0 = T(el.t ?? 0, ci);
      el.linhas.forEach((l, i) => {
        const ti = el.ts ? T(el.ts[i], ci) : t0 + i * (el.passo ?? 0.6);
        const y = (i - (n - 1) / 2) * lh, res = l.startsWith('=');
        scaled(0, y, pop(t, ti, 0.3), () => text(l, 0, y, res ? tam * 1.25 : tam, res ? cor(el.corResultado || 'ouro') : cor(el.cor || 'branco'), { weight: 900 }));
      });
    },
    barras(el, t, ci) {
      const v = el.valores, n = v.length, w = el.w || 800, h = el.h || 600, t0 = T(el.t ?? 0, ci);
      const mx = el.max || Math.max(...v), bw = w / n * 0.62, log = el.escala === 'log';
      const mn = el.min || 0, alt = x => (log ? Math.log10(x + 1) / Math.log10(mx + 1) : (x - mn) / (mx - mn)) * h;
      for (let i = 0; i < n; i++) {
        const ti = el.ts ? T(el.ts[i], ci) : t0 + i * (el.passo ?? 0.5); if (t < ti) continue;
        const k = easeOut(prog(t, ti, ti + (el.dur ?? 0.8)));
        const cx = -w / 2 + (i + 0.5) * w / n, bh = Math.max(10, alt(v[i]) * k);
        rr(cx - bw / 2, -bh, bw, bh, 14); ctx.fillStyle = cor((el.cores || [])[i] || 'azul'); ctx.fill();
        const val = el.textos && k >= 1 ? el.textos[i] : (el.pre || '') + fmt(lerp(0, v[i], k) / (el.div || 1), el.casas || 0) + (el.suf || '');
        text(val, cx, -bh - 40, el.tamValor || Math.min(54, bw * 0.34), '#ffffff', { weight: 900, stroke: PALETA.tinta, strokeWidth: 9 });
        if (el.rotulos) text(el.rotulos[i], cx, 50, el.tamRotulo || 40, cor(el.corRotulo || 'branco'), { weight: 900 });
      }
    },
    grade(el, t, ci) {
      const n = el.n || 100, cols = el.cols || 10, cel = el.cel || 60, gap = el.gap || 10, t0 = T(el.t ?? 0, ci);
      const rows = Math.ceil(n / cols), w = cols * (cel + gap) - gap, h = rows * (cel + gap) - gap;
      const td = el.tDestaque != null ? T(el.tDestaque, ci) : null;
      for (let i = 0; i < n; i++) {
        const col = i % cols, row = rows - 1 - Math.floor(i / cols);
        const k = pop(t, t0 + i * (el.passo ?? 0.012), 0.25); if (k <= 0) continue;
        const d = td != null && i < (el.destaque || 0) ? easeOut(prog(t, td + i * 0.04, td + i * 0.04 + 0.3)) : 0;
        const cx = -w / 2 + col * (cel + gap) + cel / 2, cy = -h / 2 + row * (cel + gap) + cel / 2;
        scaled(cx, cy, k * (1 + d * 0.1), () => {
          rr(cx - cel / 2, cy - cel / 2, cel, cel, cel * 0.2); ctx.fillStyle = d > 0.5 ? cor(el.corB || 'verde') : cor(el.corA || 'ciano'); ctx.fill();
          if (d > 0.5) { ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke(); }
        });
      }
    },
    pizza(el, t, ci) {
      const f = el.fatias, tot = f.reduce((a, b) => a + b, 0), r = el.r || 260, t0 = T(el.t ?? 0, ci);
      let a0 = -Math.PI / 2;
      f.forEach((v, i) => {
        const ti = el.ts ? T(el.ts[i], ci) : t0 + i * (el.passo ?? 0.7), k = easeOut(prog(t, ti, ti + 0.6)); if (k <= 0) { a0 += v / tot * Math.PI * 2; return; }
        const a1 = a0 + v / tot * Math.PI * 2 * k;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, a0, a1); ctx.closePath();
        ctx.fillStyle = cor((el.cores || [])[i] || 'azul'); ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = '#fff'; ctx.stroke();
        const am = (a0 + a0 + v / tot * Math.PI * 2) / 2;
        if (k > 0.6) {
          text((el.rotulos ? el.rotulos[i] : v + '%'), Math.cos(am) * r * 0.6, Math.sin(am) * r * 0.6, el.tamRotulo || 56, '#fff', { weight: 900, stroke: PALETA.tinta, strokeWidth: 9 });
        }
        a0 += v / tot * Math.PI * 2;
      });
    },
    termometro(el, t, ci) {
      const h = el.h || 520, w = 90;
      let v = el.v ?? 0.3;
      for (const kf of el.niveis || []) { const ti = T(kf.t, ci); v = lerp(v, kf.v, easeInOut(prog(t, ti, ti + (kf.dur ?? 0.9)))); }
      rr(-w / 2, -h / 2, w, h, w / 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = '#cbd5e1'; ctx.stroke();
      const c = `rgb(${Math.round(lerp(59, 239, v))},${Math.round(lerp(130, 68, v))},${Math.round(lerp(246, 68, v))})`;
      const fh = (h - 60) * v;
      rr(-w / 2 + 18, h / 2 - 40 - fh, w - 36, fh + 20, 20); ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.arc(0, h / 2 + 20, 70, 0, 7); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = '#cbd5e1'; ctx.stroke();
      if (el.mostraValor) text(fmt(lerp(el.min ?? 0, el.max ?? 100, v), el.casas || 0) + (el.suf || '%'), 150, h / 2 - 40 - fh, 64, '#fff', { weight: 900, stroke: PALETA.tinta, strokeWidth: 10, align: 'left' });
    },
    multidao(el, t, ci) {
      const linhas = el.linhas || [5], s = el.s || 0.32, dx = el.dx || 90 , dy = el.dy || 120, t0 = T(el.t ?? 0, ci);
      linhas.forEach((qtd, r) => {
        const k = pop(t, t0 + r * (el.passo ?? 0.25), 0.3); if (k <= 0) return;
        for (let i = 0; i < qtd; i++) {
          const x = (i - (qtd - 1) / 2) * dx, y = (r - (linhas.length - 1) / 2) * dy + dy / 2;
          scaled(x, y, k, () => boneco(x, y, s, cor((el.cores && el.cores[r]) || el.cor || 'cinza'), null, 0, { t }));
        }
      });
    },
    escada(el) {
      const n = el.degraus || 4, w = el.w || 860, h = el.h || 560, sw = w / n, sh = h / n;
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + i * sw, y = h / 2 - (i + 1) * sh;
        rr(x, y, sw - 8, (i + 1) * sh, 12); ctx.fillStyle = cor((el.cores || [])[i] || 'cinza'); ctx.fill();
        if (el.rotulos) text(el.rotulos[i], x + sw / 2 - 4, y + 50, el.tamRotulo || 40, '#fff', { weight: 900 });
      }
    },
    seta(el, t, ci) {
      const [x1, y1] = el.de, [x2, y2] = el.para, t0 = T(el.t ?? 0, ci), k = easeInOut(prog(t, t0, t0 + (el.dur ?? 0.6)));
      if (k <= 0) return;
      const xe = lerp(x1, x2, k), ye = lerp(y1, y2, k);
      ctx.save(); ctx.strokeStyle = cor(el.cor || 'ouro'); ctx.fillStyle = cor(el.cor || 'ouro'); ctx.lineWidth = el.larg || 12; ctx.lineCap = 'round';
      if (el.tracejada) { ctx.setLineDash([26, 22]); ctx.lineDashOffset = -t * 60; }
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(xe, ye); ctx.stroke(); ctx.setLineDash([]);
      if (!el.semPonta) {
        const a = Math.atan2(y2 - y1, x2 - x1), p = (el.larg || 12) * 2.6;
        ctx.beginPath(); ctx.moveTo(xe + Math.cos(a) * p * 0.6, ye + Math.sin(a) * p * 0.6);
        ctx.lineTo(xe + Math.cos(a + 2.5) * p, ye + Math.sin(a + 2.5) * p); ctx.lineTo(xe + Math.cos(a - 2.5) * p, ye + Math.sin(a - 2.5) * p); ctx.fill();
      }
      ctx.restore();
    },
    som() {},
  };
  const SEMPOP = new Set(['contador', 'conta', 'barras', 'grade', 'pizza', 'seta', 'moedas', 'multidao', 'som', 'termometro']);
  const ABSOLUTO = new Set(['seta']);

  function estado(el, t, ci) {
    let x = el.x ?? 540, y = el.y ?? 960, s = el.s ?? 1, rot = el.rot ?? 0, a = 1;
    for (const mv of el.move || []) {
      const t0 = T(mv.t, ci), k = easeInOut(prog(t, t0, t0 + (mv.dur ?? 0.7)));
      if (k <= 0) continue;
      const arc = mv.arco ? -Math.sin(k * Math.PI) * mv.arco : 0;
      x = lerp(x, mv.x ?? x, k); y = lerp(y, mv.y ?? y, k) + arc;
      s = lerp(s, mv.s ?? s, k); rot = lerp(rot, mv.rot ?? rot, k);
      if (mv.a != null) a = lerp(a, mv.a, k);
    }
    if (el.flutua) y += Math.sin(t * 2.2 + (el._i || 0) * 1.7) * (el.flutua === true ? 14 : el.flutua);
    if (el.balanca) rot += Math.sin(t * 1.6 + (el._i || 0)) * 0.05;
    if (el.gira) rot += t * el.gira;
    const t0 = T(el.t ?? 0, ci), anim = el.anim ?? (SEMPOP.has(el.tipo) ? 'nenhum' : 'pop');
    let k;
    if (anim === 'pop') k = pop(t, t0, 0.35);
    else if (anim === 'fade') { k = t >= t0 ? 1 : 0; a *= prog(t, t0, t0 + 0.4); }
    else k = t >= t0 ? 1 : 0;
    if (el.sai != null) {
      const ts = T(el.sai, ci), q = prog(t, ts, ts + 0.25);
      if (anim === 'pop') k *= 1 - easeOut(q); else a *= 1 - q;
    }
    return { x, y, s: s * k, rot, a };
  }
  function desenha(el, t, ci) {
    const st = estado(el, t, ci);
    if (st.s <= 0.001 || st.a <= 0.001) return;
    ctx.save(); ctx.globalAlpha *= st.a;
    if (!ABSOLUTO.has(el.tipo)) { ctx.translate(st.x, st.y); ctx.rotate(st.rot); ctx.scale(st.s, st.s); }
    const fn = TIPOS[el.tipo];
    if (!fn) throw new Error('tipo desconhecido: ' + el.tipo);
    fn(el, t, ci);
    ctx.restore();
  }

  // ---------- legendas e moldura ----------
  function legendas(t) {
    let c = null;
    for (const f of TP.falas) for (const l of f.legendas) if (t >= l.s - 0.05 && t < l.e) c = l;
    if (!c) return;
    const k = pop(t, c.s - 0.05, 0.25), size = 60, lines = wrapLines(c.t, size, 880, 800);
    const lh = size * 1.25, bh = lines.length * lh + 56, cy = 1590;
    scaled(W / 2, cy, lerp(0.85, 1, clamp(k)), () => {
      ctx.save(); ctx.globalAlpha = clamp(k * 1.5);
      const bw = Math.max(...lines.map(l => largura(l, size, 800)));
      rr(W / 2 - bw / 2 - 44, cy - bh / 2, bw + 88, bh, 30);
      ctx.fillStyle = 'rgba(8,12,28,0.86)'; ctx.fill();
      lines.forEach((l, i) => text(l, W / 2, cy - (lines.length - 1) * lh / 2 + i * lh + 2, size, '#ffffff', { weight: 800 }));
      ctx.restore();
    });
  }
  function proximo(t) {
    if (!RT.proximo) return;
    const ul = TP.cenas.length - 1, t0 = TP.cenas[ul] + 0.8;
    const k = pop(t, t0, 0.4); if (k <= 0) return;
    scaled(W / 2, 1800, k, () => { ctx.save(); ctx.translate(W / 2, 1800); selo('AMANHÃ: ' + RT.proximo, 34, 'rgba(245,179,1,0.95)', PALETA.tinta, 4); ctx.restore(); });
  }

  // índice de cada elemento (usado para variar flutuação)
  RT.cenas.forEach(c => c.els.forEach((el, i) => { el._i = i; }));

  function render(t) {
    t = clamp(t, 0, DURATION - 0.001);
    let ci = 0;
    for (let i = 0; i < TP.cenas.length; i++) if (t >= TP.cenas[i]) ci = i;
    const cena = RT.cenas[ci];
    ctx.clearRect(0, 0, W, H);
    (FUNDOS[cena.fundo] || bgEscuro)(t);
    for (const el of cena.els) desenha(el, t, ci);
    legendas(t);
    proximo(t);
    for (let i = 1; i < TP.cenas.length; i++) {
      const d = Math.abs(t - TP.cenas[i]);
      if (d < 0.14) { ctx.fillStyle = `rgba(255,255,255,${(1 - d / 0.14) * 0.75})`; ctx.fillRect(0, 0, W, H); }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, H - 10, W, 10);
    ctx.fillStyle = PALETA.ouro; ctx.fillRect(0, H - 10, W * t / DURATION, 10);
  }

  // ---------- efeitos sonoros ----------
  // Lista de sons com o instante de cada um; sonorizar.py sintetiza e mistura.
  function sons() {
    const out = [];
    const add = (t, som, f, g, extra = {}) => out.push(Object.assign({ t: +t.toFixed(3), som, f, g }, extra));
    for (let i = 1; i < TP.cenas.length; i++) add(TP.cenas[i] - 0.25, 'sopro', 0, 0.55);
    RT.cenas.forEach((cena, ci) => cena.els.forEach(el => {
      const t0 = T(el.t ?? 0, ci);
      const inicioCena = Math.abs(t0 - TP.cenas[ci]) < 0.12;
      const g = inicioCena ? 0.6 : 1;
      if (el.som !== false && el.som !== undefined && typeof el.som === 'string') add(t0, el.som, el.f || 0, el.g ?? 0.5);
      else if (el.som !== false) {
        switch (el.tipo) {
          case 'texto': add(t0, 'pop', 520, 0.45 * g); break;
          case 'selo': add(t0, 'pop', 660, 0.5 * g); if (el.brilho) add(t0 + 0.02, 'sino', 1568, 0.3); break;
          case 'etiqueta': add(t0, 'pop', 600, 0.35 * g); break;
          case 'boneco': if ((el.anim ?? 'pop') === 'pop') add(t0, 'pop', 440, 0.3 * g); break;
          case 'nota': case 'emoji': case 'balao': add(t0, 'pop', el.tipo === 'balao' ? 720 : 580, 0.4 * g); break;
          case 'moeda': case 'ouro': add(t0, 'sino', 1568, 0.3); break;
          case 'moedas': for (let i = 0; i < (el.n || 3); i++) add(t0 + i * 0.08, 'sino', 1568 + i * 180, 0.24); break;
          case 'predio': case 'casa': case 'escudo': add(t0, 'pop', 420, 0.35 * g); if (el.tipo === 'escudo') add(t0 + 0.03, 'sino', 784, 0.3); break;
          case 'circulo': add(t0, 'pop', 560, 0.4); add(t0, 'sino', 1047 + (+el.num || 0) * 130, 0.25); break;
          case 'carimbo': add(t0, 'baque', 0, 0.7); break;
          case 'xis': add(t0, 'baque', 0, 0.5); break;
          case 'ok': add(t0, 'sino', 1319, 0.35); break;
          case 'seta': add(t0, 'sopro', 0, 0.22); break;
          case 'contador': {
            const d = el.dur || 1.5;
            for (let i = 0; i < 18; i++) add(t0 + d * Math.pow(i / 18, 0.8), 'tique', 1400 + i * 50, 0.14);
            add(t0 + d, 'sino', 2093, 0.35); break;
          }
          case 'conta': el.linhas.forEach((l, i) => {
            const ti = el.ts ? T(el.ts[i], ci) : t0 + i * (el.passo ?? 0.6);
            add(ti, 'pop', 560 + i * 40, 0.35); if (l.startsWith('=')) add(ti + 0.02, 'sino', 1760, 0.3);
          }); break;
          case 'barras': el.valores.forEach((v, i) => {
            const ti = el.ts ? T(el.ts[i], ci) : t0 + i * (el.passo ?? 0.5);
            for (let j = 0; j < 6; j++) add(ti + j * 0.11, 'tique', 1200 + i * 150 + j * 60, 0.15);
            add(ti + (el.dur ?? 0.8), 'sino', 1319 + i * 190, 0.25);
          }); break;
          case 'grade': for (let i = 0; i < 30; i++) add(t0 + i * (el.n || 100) / 30 * (el.passo ?? 0.012), 'tique', 1200 + i * 25, 0.18);
            if (el.tDestaque != null) for (let i = 0; i < Math.min(8, el.destaque || 0); i++) add(T(el.tDestaque, ci) + i * 0.04, 'sino', 1568 + i * 60, 0.15);
            break;
          case 'pizza': el.fatias.forEach((_, i) => add(el.ts ? T(el.ts[i], ci) : t0 + i * (el.passo ?? 0.7), 'pop', 520 + i * 80, 0.4)); break;
          case 'multidao': (el.linhas || [5]).forEach((_, r) => add(t0 + r * (el.passo ?? 0.25), 'pop', 480 + r * 60, 0.3)); break;
          case 'termometro': (el.niveis || []).forEach(kf => add(T(kf.t, ci), kf.v > (el.v ?? 0.3) ? 'subida' : 'descida', 0, 0.12, { dur: kf.dur ?? 0.9 })); break;
          default: break;
        }
      }
      for (const mv of el.move || []) if (mv.som !== false && (mv.arco || mv.som)) add(T(mv.t, ci), mv.som || 'sopro', 0, 0.28, { dur: mv.dur ?? 0.7 });
      for (const sx of el.sons || []) add(T(sx.t, ci), sx.som, sx.f || 0, sx.g ?? 0.5, { dur: sx.dur });
    }));
    if (RT.proximo) add(TP.cenas[TP.cenas.length - 1] + 0.8, 'pop', 700, 0.35);
    return out.sort((a, b) => a.t - b.t);
  }

  window.render = render;
  window.sons = sons;
  window.DURATION = DURATION;
})();
