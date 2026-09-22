import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStationThreshold } from './stationThresholdCapture.mjs';

function record() {
  const samples = Array.from({ length: 127 }, (_, i) => {
    const t = i / 60, x = Math.min(1, t / 1.4);
    return { rafTimestamp: 1000 + t * 1000, frameTimestampMs: 1000 + t * 1000, offsetSeconds: t, elapsedSeconds: Math.min(t, 1.4), district: 'concourse', durationSeconds: 1.4,
      progress: x * x * x * (x * (x * 6 - 15) + 10), lowLinePresent: true, lowLineFrameTimestampMs: 1000 + t * 1000,
      lowLineOpacity: t <= 0.8 ? 0 : t >= 1.2 ? 1 : (t - 0.8) / 0.4 };
  });
  return { samples, frames: [{ requestedOffsetSeconds: -0.5, offsetSeconds: -0.5 }, ...[0, 0.4, 0.8, 1.2, 1.4, 2].map(t => ({
    requestedOffsetSeconds: t, offsetSeconds: samples.find(s => s.offsetSeconds >= t).offsetSeconds
  }))] };
}
test('signed fill and low-line gates use actual frame timestamps', () => {
  assert.deepEqual(validateStationThreshold(record(), { requireLowLine: true }), []);
});
test('late screenshots cannot pass by keeping nominal offset labels', () => {
  const r = record();
  r.frames.find(f => f.requestedOffsetSeconds === 0.4).offsetSeconds = 1.9;
  assert.match(validateStationThreshold(r).join('\n'), /actual frame.*0.4/);
});
test('observed early opacity, missed progress, and reduced-motion fading fail independently', () => {
  const r = record();
  r.samples.find(s => s.offsetSeconds === 0.4).lowLineOpacity = 0.1;
  r.samples.find(s => s.offsetSeconds === 1.2).progress = 0.9;
  const errors = validateStationThreshold(r, { requireLowLine: true, reducedMotion: true }).join('\n');
  assert.match(errors, /hidden through/);
  assert.match(errors, /at least 0.95/);
  assert.match(errors, /steps without fading/);
});

test('a previous renderer frame cannot borrow the current probe timestamp', () => {
  const r = record();
  r.samples[72].frameTimestampMs -= 16.7;
  assert.match(validateStationThreshold(r).join('\n'), /same actual animation frame/);
});

test('a late low-line writer cannot borrow the current fill timestamp', () => {
  const r = record();
  r.samples[72].lowLineFrameTimestampMs -= 16.7;
  assert.match(validateStationThreshold(r).join('\n'), /low-line style was updated/);
});
