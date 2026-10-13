const fs = require('fs');
const path = require('path');
const { createCanvas } = require('./weekly/node_modules/@napi-rs/canvas');

function drawIcon(size, isMaskable = false) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  const radius = isMaskable ? 0 : size * 0.22;
  ctx.save();
  if (!isMaskable) {
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.clip();
  }

  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#1d35a6');
  grad.addColorStop(0.5, '#2f4fd8');
  grad.addColorStop(1, '#0e1738');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle circular accents
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.beginPath();
  ctx.arc(size * 0.85, size * 0.15, size * 0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.beginPath();
  ctx.arc(size * 0.15, size * 0.85, size * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Central emblem: Notebook / Book + "V9"
  // Book base shape
  const scale = isMaskable ? 0.72 : 0.82;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.scale(scale, scale);

  // Open book outline/pages
  const bw = size * 0.58;
  const bh = size * 0.44;
  const by = -bh * 0.32;

  // Book pages back
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  // Left page
  ctx.moveTo(0, by + bh * 0.85);
  ctx.quadraticCurveTo(-bw * 0.25, by + bh * 0.75, -bw * 0.5, by + bh * 0.8);
  ctx.lineTo(-bw * 0.5, by);
  ctx.quadraticCurveTo(-bw * 0.25, by - bh * 0.05, 0, by + bh * 0.05);
  // Right page
  ctx.quadraticCurveTo(bw * 0.25, by - bh * 0.05, bw * 0.5, by);
  ctx.lineTo(bw * 0.5, by + bh * 0.8);
  ctx.quadraticCurveTo(bw * 0.25, by + bh * 0.75, 0, by + bh * 0.85);
  ctx.closePath();
  ctx.fill();

  // Book spine shadow
  ctx.fillStyle = 'rgba(24, 33, 58, 0.15)';
  ctx.fillRect(-size * 0.015, by, size * 0.03, bh * 0.85);

  // Big Bold "V" in royal blue / gold
  ctx.fillStyle = '#2f4fd8';
  ctx.font = `bold ${Math.round(size * 0.26)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('V', -bw * 0.25, by + bh * 0.38);

  // Class 9 badge on right page
  ctx.fillStyle = '#b4641a';
  ctx.font = `bold ${Math.round(size * 0.26)}px sans-serif`;
  ctx.fillText('9', bw * 0.25, by + bh * 0.38);

  // Star / spark at top spine
  ctx.fillStyle = '#ffe86b';
  ctx.beginPath();
  const starY = by - bh * 0.15;
  const starR = size * 0.06;
  for (let i = 0; i < 5; i++) {
    const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const sx = Math.cos(a) * starR;
    const sy = starY + Math.sin(a) * starR;
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
  ctx.fill();

  // "PLANNER" pill banner below book
  const pillW = size * 0.62;
  const pillH = size * 0.14;
  const pillY = by + bh * 0.95;

  ctx.fillStyle = '#ffe86b';
  ctx.beginPath();
  const pr = pillH / 2;
  ctx.moveTo(-pillW / 2 + pr, pillY);
  ctx.lineTo(pillW / 2 - pr, pillY);
  ctx.quadraticCurveTo(pillW / 2, pillY, pillW / 2, pillY + pr);
  ctx.lineTo(pillW / 2, pillY + pillH - pr);
  ctx.quadraticCurveTo(pillW / 2, pillY + pillH, pillW / 2 - pr, pillY + pillH);
  ctx.lineTo(-pillW / 2 + pr, pillY + pillH);
  ctx.quadraticCurveTo(-pillW / 2, pillY + pillH, -pillW / 2, pillY + pillH - pr);
  ctx.lineTo(-pillW / 2, pillY + pr);
  ctx.quadraticCurveTo(-pillW / 2, pillY, -pillW / 2 + pr, pillY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#18213a';
  ctx.font = `bold ${Math.round(size * 0.08)}px sans-serif`;
  ctx.fillText('STUDY PLANNER', 0, pillY + pillH * 0.52);

  ctx.restore();
  ctx.restore();

  return canvas.toBuffer('image/png');
}

const outDir = path.join(__dirname, '..', '1_Planner', 'icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'icon-192.png'), drawIcon(192));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), drawIcon(512));
fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), drawIcon(512, true));
fs.writeFileSync(path.join(outDir, 'favicon.png'), drawIcon(64));

console.log('Icons generated successfully in ' + outDir);
