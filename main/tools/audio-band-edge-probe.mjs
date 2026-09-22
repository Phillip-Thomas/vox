// Stage 2 repair (S2-J2): band-energy over time across a submergence edge.
//
//   node tools/audio-band-edge-probe.mjs <file.wav> [--from 6] [--to 12]
//        [--step 0.1] [--out <json>]
//
// A blind listener read the dive render's 8 s edge as a "brick-wall lowpass
// switching in". The music path's submerge filter is slewed (0.42 s entering,
// 0.65 s leaving, audioCore rampParamAt), so the claim is testable: sample the
// energy in four bands every `--step` seconds and look at how many steps the
// high band takes to fall. A switch falls in one step; a slew takes four.
//
// Pure Node — no ffmpeg, no numpy. Reads 16-bit or 32-bit-float PCM WAV.
import fs from 'node:fs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('usage: audio-band-edge-probe.mjs <file.wav> [--from s] [--to s] [--step s] [--out json]');
  process.exit(2);
}
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const fromS = Number(flag('from', '6'));
const toS = Number(flag('to', '12'));
const stepS = Number(flag('step', '0.1'));
const outFile = flag('out', undefined);

/** Minimal WAV reader: mono-sums every channel, returns Float32 + sample rate. */
function readWav(path) {
  const buf = fs.readFileSync(path);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${path} is not a RIFF/WAVE file`);
  }
  let offset = 12;
  let fmt = null;
  let data = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = buf.subarray(offset + 8, offset + 8 + size);
    if (id === 'fmt ') {
      fmt = {
        format: body.readUInt16LE(0),
        channels: body.readUInt16LE(2),
        sampleRate: body.readUInt32LE(4),
        bits: body.readUInt16LE(14)
      };
    } else if (id === 'data') {
      data = body;
    }
    offset += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('missing fmt or data chunk');
  const bytes = fmt.bits / 8;
  const frames = Math.floor(data.length / (bytes * fmt.channels));
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let c = 0; c < fmt.channels; c++) {
      const at = (f * fmt.channels + c) * bytes;
      sum += fmt.format === 3 ? data.readFloatLE(at) : bytes === 2 ? data.readInt16LE(at) / 32768 : data.readInt32LE(at) / 2147483648;
    }
    out[f] = sum / fmt.channels;
  }
  return { samples: out, sampleRate: fmt.sampleRate };
}

/** In-place iterative radix-2 FFT on separate real/imag arrays. */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

const BANDS = [
  ['lo', 0, 500],
  ['mid', 500, 2000],
  ['hi', 2000, 8000],
  ['air', 8000, 22050]
];
const N = 4096;

const { samples, sampleRate } = readWav(file);
const window = new Float32Array(N);
for (let i = 0; i < N; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));

const rows = [];
for (let t = fromS; t <= toS + 1e-9; t += stepS) {
  const start = Math.round(t * sampleRate);
  if (start + N > samples.length) break;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = samples[start + i] * window[i];
  fft(re, im);
  const energy = {};
  for (const [name] of BANDS) energy[name] = 0;
  for (let k = 1; k < N / 2; k++) {
    const hz = (k * sampleRate) / N;
    const mag2 = re[k] * re[k] + im[k] * im[k];
    for (const [name, lo, hi] of BANDS) {
      if (hz >= lo && hz < hi) energy[name] += mag2;
    }
  }
  const db = {};
  for (const [name] of BANDS) db[name] = 10 * Math.log10(Math.max(1e-20, energy[name]));
  rows.push({ tS: Math.round(t * 1000) / 1000, db });
}

// Fall time of the `hi` band: from its pre-edge plateau to within 1 dB of its
// post-edge plateau. That is the number the "brick wall" claim is about.
const hi = rows.map((r) => r.db.hi);
const before = hi.slice(0, Math.max(1, Math.floor(rows.length * 0.15)));
const after = hi.slice(Math.floor(rows.length * 0.75));
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const plateauBefore = mean(before);
const plateauAfter = mean(after);
let fellFromS = null;
let fellToS = null;
for (const r of rows) {
  if (fellFromS == null && r.db.hi <= plateauBefore - 1) fellFromS = r.tS;
  if (fellFromS != null && fellToS == null && r.db.hi <= plateauAfter + 1) fellToS = r.tS;
}
const summary = {
  file,
  sampleRate,
  windowSamples: N,
  windowS: N / sampleRate,
  stepS,
  fromS,
  toS,
  bands: BANDS.map(([n, lo, h]) => ({ name: n, loHz: lo, hiHz: h })),
  hiBandPlateauBeforeDb: Math.round(plateauBefore * 100) / 100,
  hiBandPlateauAfterDb: Math.round(plateauAfter * 100) / 100,
  hiBandDropDb: Math.round((plateauBefore - plateauAfter) * 100) / 100,
  hiBandFellFromS: fellFromS,
  hiBandFellToS: fellToS,
  hiBandFallS: fellFromS != null && fellToS != null ? Math.round((fellToS - fellFromS) * 1000) / 1000 : null,
  rows
};

for (const r of rows) {
  console.log(
    `${r.tS.toFixed(2)}s  lo ${r.db.lo.toFixed(1)}  mid ${r.db.mid.toFixed(1)}  hi ${r.db.hi.toFixed(1)}  air ${r.db.air.toFixed(1)}`
  );
}
console.log(
  `[fall] hi band ${summary.hiBandPlateauBeforeDb} → ${summary.hiBandPlateauAfterDb} dB (${summary.hiBandDropDb} dB) ` +
    `between ${summary.hiBandFellFromS}s and ${summary.hiBandFellToS}s = ${summary.hiBandFallS}s over ${summary.stepS}s steps ` +
    `(analysis window ${(summary.windowS * 1000).toFixed(0)} ms)`
);
if (outFile) {
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));
  console.log(`[out] ${outFile}`);
}
