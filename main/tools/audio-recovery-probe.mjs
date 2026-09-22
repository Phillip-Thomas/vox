import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const out = path.resolve(process.argv[2] ?? '../.codex/production-runs/2026-09-04-audio-10x/evidence/recovery');
fs.mkdirSync(out, { recursive: true });
const distIndex = path.join(process.cwd(), 'dist/index.html');
const distHash = () => fs.existsSync(distIndex) ? createHash('sha256').update(fs.readFileSync(distIndex)).digest('hex') : null;
const distBefore = distHash();
const server = await createServer({ configFile: false, root: process.cwd(), plugins: [react()], server: { port: 0, hmr: false, watch: null } });
await server.listen();
const port = server.httpServer.address().port;
const cache = path.join(os.homedir(), '.cache/ms-playwright');
const install = fs.readdirSync(cache).filter(name => /^chromium-\d+$/.test(name)).sort().pop();
const executablePath = path.join(cache, install, 'chrome-linux/chrome');
const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const report = { createdAt: new Date().toISOString(), mine: [], fingerprints: [], spatial: [], rooms: [], voice: [], verdicts: [] };
const save = () => fs.writeFileSync(path.join(out, 'audio-recovery.json'), JSON.stringify(report, null, 2));
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(180000);
  page.on('pageerror', error => { throw error; });
  await page.goto(`http://localhost:${port}/score-soak.html`);
  const run = (name, args) => page.evaluate(async ({ name, args }) => (await import('/src/audio/soak/recoveryEvidence.ts'))[name](...args), { name, args });
  if (process.argv.includes('--calibrate-voice')) {
    report.calibration = [];
    for (const sourceGain of [0.12, 0.18, 0.24, 0.32, 0.45]) {
      const { wavBase64, ...result } = await run('renderVoiceTrial', ['alive', { sustained: true, sourceGain }]);
      fs.writeFileSync(path.join(out, `voice-alive-source-${sourceGain}.wav`), Buffer.from(wavBase64, 'base64'));
      report.calibration.push(result);
      console.log(JSON.stringify({ sourceGain, I: result.loudness.integratedLufs, S: result.loudness.shortTermMaxLufs, TP: result.loudness.truePeakDbtp }));
    }
  } else {
  const reference = await run('renderSfxTrial', ['mine', 1, { variation: false }]);
  for (let index = 1; index <= 200; index++) {
    report.mine.push(await run('renderSfxTrial', ['mine', index]));
    if (index % 25 === 0) { console.log(`mine ${index}/200`); save(); }
  }
  const distinct = new Set(report.mine.map(row => row.hash)).size;
  const deviation = Math.max(...report.mine.map(row => Math.abs(row.peak / reference.peak - 1)));
  report.mineReference = reference;
  report.verdicts.push({ id: 'mine-pcm-variation', distinct, maxPeakDeviation: deviation, met: distinct >= 190 && deviation <= 0.15 });
  const replay = await run('renderSfxTrial', ['mine', 37]);
  report.verdicts.push({ id: 'mine-replay', met: replay.hash === report.mine[36].hash });
  const events = ['jump', 'land', 'mine', 'blocked', 'boardShip', 'exitShip', 'shipLaunch', 'shipBoost', 'shipLand', 'shipCrash', 'splashEnter', 'splashExit', 'terminalKey', 'terminalAdvance', 'terminalAlarm', 'terminalCorrupt', 'storyGlitch', 'storyAwaken', 'storySleep'];
  for (const event of events) {
    const nominal = await run('renderSfxTrial', [event, 1, { variation: false }]), varied = await run('renderSfxTrial', [event, 1]);
    const delta = { peak: Math.abs(varied.peak / nominal.peak - 1), duration: Math.abs((varied.lastAudible - 0.08) / (nominal.lastAudible - 0.08) - 1), centroid: Math.abs(varied.fingerprint.centroidHz / nominal.fingerprint.centroidHz - 1), bandwidth: Math.abs(varied.fingerprint.bandwidthHz / nominal.fingerprint.bandwidthHz - 1) };
    report.fingerprints.push({ event, nominal, varied, delta });
    report.verdicts.push({ id: `recipe-fingerprint.${event}`, limits: { peak: 0.15, duration: 0.15, centroid: 0.15, bandwidth: 0.15 }, delta, met: Object.values(delta).every(value => value <= 0.15) });
  }
  for (const x of [-20, -4, 0, 4, 20]) report.spatial.push({ x, ...(await run('renderSfxTrial', ['mine', 1, { variation: false, position: { x, y: 0, z: 0 } }])) });
  const maxPanError = Math.max(...report.spatial.map(row => Math.abs(row.pan - Math.sign(row.x) * 0.85)));
  const measuredDistanceRatio = report.spatial[0].rms[0] / report.spatial[1].rms[0];
  const distanceGainErrorDb = Math.abs(20 * Math.log10(measuredDistanceRatio / (4 / (4 + 1.2 * (20 - 4)))));
  report.verdicts.push({ id: 'spatial-pan-gain', maxPanError, distanceGainErrorDb, met: maxPanError <= 0.02 && distanceGainErrorDb <= 0.25 });
  for (const room of ['plain', 'underwater', 'interior', 'station', 'cave']) report.rooms.push(await run('renderRoomTrial', [room]));
  for (const room of ['plain', 'underwater']) report.rooms.push(await run('renderRoomTrial', [room, 'lean']));
  for (const rung of ['bare', 'colour', 'material', 'alive']) {
    const { wavBase64, ...result } = await run('renderVoiceTrial', [rung]);
    fs.writeFileSync(path.join(out, `voice-${rung}.wav`), Buffer.from(wavBase64, 'base64'));
    report.voice.push(result);
  }
  const { wavBase64: sustainedWav, ...alive } = await run('renderVoiceTrial', ['alive', { sustained: true }]);
  fs.writeFileSync(path.join(out, 'voice-alive-sustained.wav'), Buffer.from(sustainedWav, 'base64'));
  report.voiceSustained = alive;
  report.verdicts.push({ id: 'voice-alive-short-term', target: '-16 +/-1 LUFS short-term', measured: alive.loudness.shortTermMaxLufs, met: Math.abs(alive.loudness.shortTermMaxLufs + 16) <= 1 });
  console.log('SFX/room/voice trials complete; rendering narration over BLOOM'); save();
  const { wavBase64, ...voiceBloom } = await run('renderVoiceBloomTrial', []);
  fs.writeFileSync(path.join(out, 'voice-bloom.wav'), Buffer.from(wavBase64, 'base64'));
  report.voiceBloom = voiceBloom;
  report.verdicts.push({ id: 'voice-bloom-true-peak', met: report.voiceBloom.loudness.truePeakDbtp <= -1, measured: report.voiceBloom.loudness.truePeakDbtp });
  report.verdicts.push({ id: 'full-room-rt60-distinct', met: new Set(report.rooms.filter(row => row.quality === 'full').map(row => row.rt60?.toFixed(2))).size === 5 && report.rooms.every(row => row.rt60 > 0) });
  save();
  console.log(JSON.stringify({ verdicts: report.verdicts, rooms: report.rooms.map(({ room, quality, rt60 }) => ({ room, quality, rt60 })), voice: report.voice.map(({ rung, loudness }) => ({ rung, I: loudness.integratedLufs, S: loudness.shortTermMaxLufs, TP: loudness.truePeakDbtp })), voiceBloom: { I: report.voiceBloom.loudness.integratedLufs, S: report.voiceBloom.loudness.shortTermMaxLufs, TP: report.voiceBloom.loudness.truePeakDbtp } }, null, 2));
  if (report.verdicts.some(row => !row.met)) process.exitCode = 1;
  }
} finally {
  report.distProvenance = { before: distBefore, after: distHash(), toolInvokesBuild: false };
  report.distProvenance.unchanged = report.distProvenance.before === report.distProvenance.after;
  if (!report.distProvenance.unchanged) process.exitCode = 1;
  save(); await browser.close(); await server.close();
}
