// --- Pixel laws -----------------------------------------------------------------------
//
// Dependency-free PNG inflate/unfilter and the measurement functions the ch10
// draft-v9 laws were written in (hue separation over connected components with
// the cockpit mask excluded; point-source classification by angular extent; band
// occupancy; border ring). Moved verbatim from
// .codex/production-runs/2026-08-11-ch10-station-introduction/ch10-v9-frame-analysis.mjs
// so every run measures with the same functions. They measure the delivered
// frame — the HUD-suppressed twin — never a re-render.
import fs from 'node:fs';
import zlib from 'node:zlib';

// ------------------------------------------------------------------ PNG read
export function readPng(file) {
  const buf = Buffer.isBuffer(file) ? file : fs.readFileSync(file);
  let p = 8, w = 0, h = 0, bitDepth = 8, colorType = 6, interlace = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bitDepth !== 8 || interlace !== 0) throw new Error(`unsupported png ${bitDepth}/${interlace}`);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (!channels) throw new Error(`unsupported colorType ${colorType}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = new Uint8Array(w * h * 3);
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[rp++];
    raw.copy(cur, 0, rp, rp + stride); rp += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let v = cur[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[i] = v & 0xff;
    }
    for (let x = 0; x < w; x++) {
      const s = x * channels, d = (y * w + x) * 3;
      out[d] = cur[s]; out[d + 1] = channels === 1 ? cur[s] : cur[s + 1];
      out[d + 2] = channels === 1 ? cur[s] : cur[s + 2];
    }
    prev.set(cur);
  }
  return { w, h, rgb: out };
}

export const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
export function hsv(r, g, b) {
  const R = r / 255, G = g / 255, B = b / 255;
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn;
  let hh = 0;
  if (d > 1e-6) {
    if (mx === R) hh = ((G - B) / d) % 6;
    else if (mx === G) hh = (B - R) / d + 2;
    else hh = (R - G) / d + 4;
    hh *= 60; if (hh < 0) hh += 360;
  }
  return { h: hh, s: mx > 0 ? d / mx : 0, v: mx };
}

// ---------------------------------------------------------- connected labels
export function components(mask, w, h, minPx) {
  const seen = new Uint8Array(w * h);
  const out = [];
  const stack = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || seen[i]) continue;
    let sp = 0; stack[sp++] = i; seen[i] = 1;
    const px = [];
    while (sp > 0) {
      const q = stack[--sp]; px.push(q);
      const x = q % w, y = (q / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (mask[n] && !seen[n]) { seen[n] = 1; stack[sp++] = n; }
      }
    }
    if (px.length >= minPx) out.push(px);
  }
  return out;
}

export function describe(px, w, rgb) {
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1, sx = 0, sy = 0;
  let peak = -1, peakAt = px[0], sumH = 0, sumS = 0, n = 0;
  for (const q of px) {
    const x = q % w, y = (q / w) | 0;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    sx += x; sy += y;
    const r = rgb[q * 3], g = rgb[q * 3 + 1], b = rgb[q * 3 + 2];
    const L = lum(r, g, b);
    if (L > peak) { peak = L; peakAt = q; }
    const c = hsv(r, g, b); sumH += c.h; sumS += c.s; n++;
  }
  return { areaPx: px.length, bbox: [minX, minY, maxX - minX + 1, maxY - minY + 1],
    extentPx: Math.max(maxX - minX + 1, maxY - minY + 1),
    centroid: [Number((sx / px.length).toFixed(1)), Number((sy / px.length).toFixed(1))],
    peakLuminance: Number(peak.toFixed(1)),
    peakAt: [peakAt % w, (peakAt / w) | 0],
    meanHueDeg: Number((sumH / n).toFixed(1)), meanSaturation: Number((sumS / n).toFixed(3)) };
}

// ------------------------------------------------------------------- masks
export function unpackMask(b64, w, h) {
  if (!b64) return null;
  const bytes = Buffer.from(b64, 'base64');
  const m = new Uint8Array(w * h);
  // The GL read is bottom-left origin; the PNG is top-left. Flip in place.
  for (let i = 0; i < w * h; i++) {
    const bit = (bytes[i >> 3] >> (i & 7)) & 1;
    if (!bit) continue;
    const x = i % w, y = (i / w) | 0;
    m[(h - 1 - y) * w + x] = 1;
  }
  return m;
}

// ------------------------------------------------------------------ analyses
export const WARM = (c) => (c.h <= 70 || c.h >= 330) && c.s >= 0.18 && c.v >= 0.12;
export const COOLMAG = (c) => c.h > 250 && c.h < 330;

export function hueLaw(img, cockpitMask, label) {
  const { w, h, rgb } = img;
  const inAperture = new Uint8Array(w * h);
  let apPx = 0;
  for (let i = 0; i < w * h; i++) {
    if (cockpitMask && cockpitMask[i]) continue;
    inAperture[i] = 1; apPx++;
  }
  const warm = new Uint8Array(w * h);
  let warmPx = 0, coolPx = 0, neutralLit = 0;
  for (let i = 0; i < w * h; i++) {
    if (!inAperture[i]) continue;
    const c = hsv(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
    if (c.v < 0.12) continue;
    if (WARM(c)) { warm[i] = 1; warmPx++; }
    else if (COOLMAG(c)) coolPx++;
    else neutralLit++;
  }
  const comps = components(warm, w, h, 12).map(px => describe(px, w, rgb))
    .sort((a, b) => b.areaPx - a.areaPx);
  // Brightest value anywhere in the aperture, and the cockpit-adjacency of each
  // warm cluster: a cluster whose dilated ring lands on cockpit-mask pixels is
  // cockpit-rigid furniture, not a sky body.
  let apPeak = -1, apPeakAt = null;
  for (let i = 0; i < w * h; i++) {
    if (!inAperture[i]) continue;
    const L = lum(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
    if (L > apPeak) { apPeak = L; apPeakAt = [i % w, (i / w) | 0]; }
  }
  if (cockpitMask) for (const c of comps) {
    const [bx, by, bw, bh] = c.bbox;
    let ring = 0, onCockpit = 0;
    for (let y = by - 3; y <= by + bh + 2; y++) for (let x = bx - 3; x <= bx + bw + 2; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      if (x >= bx && x < bx + bw && y >= by && y < by + bh) continue;
      ring++; if (cockpitMask[y * w + x]) onCockpit++;
    }
    c.cockpitRingFraction = ring ? Number((onCockpit / ring).toFixed(3)) : null;
  }
  return { label, aperturePixels: apPx, cockpitMaskApplied: !!cockpitMask,
    aperturePeakLuminance: Number(apPeak.toFixed(1)), aperturePeakAt: apPeakAt,
    warmPixelsInAperture: warmPx, coolMagentaPixelsInAperture: coolPx,
    neutralLitPixelsInAperture: neutralLit,
    warmClusters: comps.length, clusters: comps.slice(0, 8) };
}

export function skyMask(img, pitchDeg, fovVDeg) {
  // A light source above the horizon is a SKY source. The mask is geometric,
  // not a colour guess: for a roll-free surface camera (the shipped free-look
  // keeps the horizon level) the ray through each pixel has a closed-form
  // altitude, so "above the horizon" is derivable from the recorded pitch and
  // lens alone and does not depend on where anything happens to sit.
  const { w, h } = img;
  const p = (pitchDeg * Math.PI) / 180;
  const tV = Math.tan((fovVDeg * Math.PI) / 180 / 2);
  const tH = tV * (w / h);
  const m = new Uint8Array(w * h);
  let n = 0;
  for (let y = 0; y < h; y++) {
    const ndcY = 1 - (2 * (y + 0.5)) / h;
    for (let x = 0; x < w; x++) {
      const ndcX = (2 * (x + 0.5)) / w - 1;
      const rx = ndcX * tH, ry = ndcY * tV;
      // frame: worldUp=(0,1,0); F=(0,sin p,cos p); U=(0,cos p,-sin p); R=(1,0,0)
      const dy = ry * Math.cos(p) + Math.sin(p);
      const dz = -ry * Math.sin(p) + Math.cos(p);
      const len = Math.hypot(rx, dy, dz);
      if (dy / len > 0) { m[y * w + x] = 1; n++; }
    }
  }
  return { mask: m, skyPixels: n, pitchDeg, fovVDeg };
}

export function pointSourceLaw(img, st0Px, sky) {
  const { w, h, rgb } = img;
  const scale = 1280 / w;
  // ST-0's own peak, measured at its PROJECTED pixel rather than by hoping a
  // threshold finds it: a 2.4-device-pixel quad can sit below any global cut.
  let st0Peak = -1, st0PeakAt = null, st0Above60 = 0;
  const R = 6;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const x = st0Px[0] + dx, y = st0Px[1] + dy;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const i = (y * w + x) * 3;
    const L = lum(rgb[i], rgb[i + 1], rgb[i + 2]);
    if (L >= 60) st0Above60++;
    if (L > st0Peak) { st0Peak = L; st0PeakAt = [x, y]; }
  }
  // ST-0's extent, from its own half-peak contour in the same window.
  let ex0 = 1e9, ex1 = -1, ey0 = 1e9, ey1 = -1, half = st0Peak * 0.5;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const x = st0Px[0] + dx, y = st0Px[1] + dy;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const i = (y * w + x) * 3;
    if (lum(rgb[i], rgb[i + 1], rgb[i + 2]) >= half) {
      if (x < ex0) ex0 = x; if (x > ex1) ex1 = x;
      if (y < ey0) ey0 = y; if (y > ey1) ey1 = y;
    }
  }
  const st0Extent = ex1 >= 0 ? Math.max(ex1 - ex0 + 1, ey1 - ey0 + 1) : 0;
  // Every other lit thing ABOVE THE HORIZON, classified by extent first.
  const bright = new Uint8Array(w * h);
  let n = 0;
  for (let i = 0; i < w * h; i++) {
    if (!sky.mask[i]) continue;
    const L = lum(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
    if (L >= 60) { bright[i] = 1; n++; }
  }
  const comps = components(bright, w, h, 1).map(px => describe(px, w, rgb));
  for (const c of comps) c.extentPxAt1280 = Number((c.extentPx * scale).toFixed(2));
  const isSt0 = (c) => Math.hypot(c.centroid[0] - st0Px[0], c.centroid[1] - st0Px[1]) <= 4;
  const points = comps.filter(c => c.extentPxAt1280 <= 8 && !isSt0(c))
    .sort((a, b) => b.peakLuminance - a.peakLuminance);
  const discs = comps.filter(c => c.extentPxAt1280 > 8 && !isSt0(c))
    .sort((a, b) => b.peakLuminance - a.peakLuminance);
  return { skyPixels: sky.skyPixels, pitchDeg: sky.pitchDeg, fovVDeg: sky.fovVDeg,
    litSkyPixels: n, skySources: comps.length,
    pointSources: points.length, discSources: discs.length,
    st0ProjectedPx: st0Px, st0PeakLuminance: Number(st0Peak.toFixed(1)),
    st0PeakAt: st0PeakAt, st0PixelsAbove60: st0Above60,
    st0ExtentPx: st0Extent, st0ExtentPxAt1280: Number((st0Extent * scale).toFixed(2)),
    brightestPointSource: points[0] ?? null,
    brightestDisc: discs[0] ?? null,
    st0BeatsBrightestPointSource: points[0] ? st0Peak > points[0].peakLuminance : true,
    st0BelowBrightestDisc: discs[0] ? st0Peak < discs[0].peakLuminance : null,
    topPointSources: points.slice(0, 8), topDiscs: discs.slice(0, 4) };
}

export function bandOccupancy(img, mask) {
  // "terrain horizon and the hearth emissive cluster occupy the bottom 20%"
  const { w, h, rgb } = img;
  const y0 = Math.floor(h * 0.8);
  let lit = 0, warm = 0, total = 0, peak = -1, peakAt = null;
  for (let y = y0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; total++;
    const c = hsv(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
    const L = lum(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
    if (c.v >= 0.06) lit++;
    if (WARM(c) && c.v >= 0.15) warm++;
    if (L > peak) { peak = L; peakAt = [x, y]; }
  }
  void mask;
  return { bandTopY: y0, bandPixels: total, litPixels: lit,
    litFraction: Number((lit / total).toFixed(4)),
    warmPixels: warm, warmFraction: Number((warm / total).toFixed(4)),
    peakLuminance: Number(peak.toFixed(1)), peakAt };
}

export function borderRing(img, ringPx = 2) {
  const { w, h, rgb } = img;
  let peak = -1, sum = 0, n = 0, peakAt = null;
  const touch = (x, y) => { const i = (y * w + x) * 3;
    const L = lum(rgb[i], rgb[i + 1], rgb[i + 2]);
    if (L > peak) { peak = L; peakAt = [x, y]; } sum += L; n++; };
  for (let y = 0; y < h; y++) for (let k = 0; k < ringPx; k++) { touch(k, y); touch(w - 1 - k, y); }
  for (let x = 0; x < w; x++) for (let k = 0; k < ringPx; k++) { touch(x, k); touch(x, h - 1 - k); }
  return { ringPx, samples: n, peakLuminance: Number(peak.toFixed(1)),
    meanLuminance: Number((sum / n).toFixed(2)), peakAt };
}

