const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function createPNG(w, h, rgbaBuf) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  
  const scanlines = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 4);
    row[0] = 0;
    rgbaBuf.copy(row, 1, y * w * 4, (y + 1) * w * 4);
    scanlines.push(row);
  }
  const idatData = zlib.deflateSync(Buffer.concat(scanlines));
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idatData),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

// Generate icon with anti-aliasing (supersampling 2x)
function renderIcon(size) {
  const scale = 2;
  const sW = size * scale;
  const sH = size * scale;
  const sBuf = Buffer.alloc(sW * sH * 4);

  const cx = sW / 2;
  const cy = sH / 2;
  const rBg = (sW / 2) - scale; // rounded circle/squircle background radius

  // Moon geometry
  // Moon outer circle
  const moonCx = cx * 0.95;
  const moonCy = cy * 0.95;
  const moonR = sW * 0.32;
  // Moon cutout circle
  const cutCx = cx * 1.15;
  const cutCy = cy * 0.82;
  const cutR = sW * 0.28;

  // Star geometry
  const star1X = sW * 0.72;
  const star1Y = sH * 0.32;
  const star1R = sW * 0.055;

  const star2X = sW * 0.75;
  const star2Y = sH * 0.65;
  const star2R = sW * 0.04;

  for (let y = 0; y < sH; y++) {
    for (let x = 0; x < sW; x++) {
      const idx = (y * sW + x) * 4;

      // Distance to center for rounded badge
      const dx = x - cx;
      const dy = y - cy;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);

      // Check squircle/circle border
      if (distFromCenter > rBg) {
        sBuf[idx] = 0;
        sBuf[idx + 1] = 0;
        sBuf[idx + 2] = 0;
        sBuf[idx + 3] = 0;
        continue;
      }

      // Background gradient (Deep Slate #0f172a to Indigo #1e1b4b)
      const t = (y / sH);
      let bgR = Math.round(15 + t * (30 - 15));
      let bgG = Math.round(23 + t * (27 - 23));
      let bgB = Math.round(42 + t * (75 - 42));

      // Border ring (Glowing Cyan / Violet rim)
      const rimDist = rBg - distFromCenter;
      if (rimDist < scale * 1.8) {
        bgR = Math.round(56 * 0.8 + bgR * 0.2);
        bgG = Math.round(189 * 0.8 + bgG * 0.2);
        bgB = Math.round(248 * 0.8 + bgB * 0.2);
      }

      // Check moon
      const dMoon = Math.sqrt((x - moonCx) ** 2 + (y - moonCy) ** 2);
      const dCut = Math.sqrt((x - cutCx) ** 2 + (y - cutCy) ** 2);
      const isMoon = (dMoon <= moonR) && (dCut > cutR);

      // Check stars (4-pointed star or dot)
      const dStar1 = Math.sqrt((x - star1X) ** 2 + (y - star1Y) ** 2);
      const dStar2 = Math.sqrt((x - star2X) ** 2 + (y - star2Y) ** 2);
      const isStar = (dStar1 <= star1R) || (dStar2 <= star2R);

      if (isMoon || isStar) {
        // Moon / Star gradient (Glowing bright cyan to warm violet)
        const myT = y / sH;
        sBuf[idx] = Math.round(56 + myT * (167 - 56));      // R
        sBuf[idx + 1] = Math.round(189 + myT * (139 - 189)); // G
        sBuf[idx + 2] = Math.round(248 + myT * (250 - 248)); // B
        sBuf[idx + 3] = 255;
      } else {
        sBuf[idx] = bgR;
        sBuf[idx + 1] = bgG;
        sBuf[idx + 2] = bgB;
        sBuf[idx + 3] = 255;
      }
    }
  }

  // Downsample 2x2 to size x size (Anti-aliasing)
  const outBuf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const sIdx = ((y * scale + sy) * sW + (x * scale + sx)) * 4;
          r += sBuf[sIdx];
          g += sBuf[sIdx + 1];
          b += sBuf[sIdx + 2];
          a += sBuf[sIdx + 3];
        }
      }
      const num = scale * scale;
      const outIdx = (y * size + x) * 4;
      outBuf[outIdx] = Math.round(r / num);
      outBuf[outIdx + 1] = Math.round(g / num);
      outBuf[outIdx + 2] = Math.round(b / num);
      outBuf[outIdx + 3] = Math.round(a / num);
    }
  }

  return createPNG(size, size, outBuf);
}

// Ensure icons folder exists
const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 32, 48, 128].forEach(size => {
  const png = renderIcon(size);
  const outPath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Generated ${outPath} (${png.length} bytes)`);
});

// Also create a high-res SVG icon for presentation/UI
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="moonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect x="4" y="4" width="120" height="120" rx="28" fill="url(#bgGrad)" stroke="#38bdf8" stroke-width="2" stroke-opacity="0.5"/>
  <path d="M 64 24 A 40 40 0 1 0 100 86 A 34 34 0 1 1 64 24 Z" fill="url(#moonGrad)" filter="url(#glow)"/>
  <circle cx="96" cy="38" r="4.5" fill="#38bdf8" filter="url(#glow)"/>
  <circle cx="102" cy="74" r="3" fill="#a78bfa" filter="url(#glow)"/>
  <path d="M 82 24 L 84 29 L 89 31 L 84 33 L 82 38 L 80 33 L 75 31 L 80 29 Z" fill="#ffffff" opacity="0.9"/>
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent, 'utf8');
console.log('SVG icon generated.');

