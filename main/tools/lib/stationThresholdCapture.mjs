// Timing evidence belongs to a rendered animation frame, not to the nominal
// filename of a screenshot whose asynchronous capture may finish much later.
export async function captureStationThreshold(page, { capturePixels = true } = {}) {
  return page.evaluate(({ capturePixels }) => new Promise((resolve, reject) => {
    const offsets = [0, 0.4, 0.8, 1.2, 1.4, 2];
    const samples = [], frames = [], before = [];
    const started = performance.now();
    let boundary = null, fillBoundary = null, previousCapture = -Infinity, nextOffset = 0;
    const stop = () => window.__spaceStationWalk?.(0, 0);
    const picture = sample => {
      const canvas = document.querySelector('canvas');
      // Snapshot inside the same rAF callback after the station renderer ran;
      // encode asynchronously so PNG compression does not stall the next frame.
      const pngPromise = capturePixels && canvas ? createImageBitmap(canvas).then(async bitmap => {
        const copy = new OffscreenCanvas(bitmap.width, bitmap.height);
        copy.getContext('2d').drawImage(bitmap, 0, 0);
        bitmap.close();
        const blob = await copy.convertToBlob({ type: 'image/png' });
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
      }).catch(error => ({ error: String(error) })) : Promise.resolve(null);
      return { ...sample, capturedAt: performance.now(), pngPromise };
    };
    const tick = rafTimestamp => {
      try {
        const fill = window.__spaceStationFill?.();
        const state = window.__spaceStationState?.();
        const low = document.querySelector('[data-testid="spaceStation-low-line"]');
        const sample = { rafTimestamp, now: performance.now(),
          frameTimestampMs: fill?.frameTimestampMs ?? null,
          crossingTimestampMs: fill?.crossingTimestampMs ?? null,
          cellId: state?.cellId ?? null, district: fill?.district ?? null,
          position: state?.position ? [...state.position] : null,
          from: fill?.from ?? null, progress: fill?.progress ?? null,
          elapsedSeconds: fill?.elapsedSeconds ?? null, durationSeconds: fill?.durationSeconds ?? null,
          ambientIntensity: fill?.ambientIntensity ?? null, fogDensity: fill?.fogDensity ?? null,
          lowLinePresent: !!low, lowLineFrameTimestampMs: low?.dataset.stationFrameTimestampMs ? Number(low.dataset.stationFrameTimestampMs) : null,
          lowLineOpacity: low ? Number(getComputedStyle(low).opacity) : null };
        // The signed origin is occupied-cell change. Keep a separate fill origin
        // so a late lighting update cannot silently move the measuring clock.
        if (boundary === null && state?.cellId === 'concourse') boundary = rafTimestamp;
        if (fillBoundary === null && fill?.district === 'concourse') fillBoundary = rafTimestamp;
        sample.offsetSeconds = boundary === null ? null : (rafTimestamp - boundary) / 1000;
        samples.push(sample);
        if (boundary === null && rafTimestamp - previousCapture >= 100) {
          // A bounded rolling buffer supplies the actual pre-threshold frame.
          before.push(picture(sample));
          if (before.length > 12) before.shift();
          previousCapture = rafTimestamp;
        }
        if (boundary !== null && nextOffset < offsets.length && sample.offsetSeconds >= offsets[nextOffset]) {
          // If slow rendering skipped multiple requested offsets, retain ONE
          // actual frame. Validation below rejects the missed timing coverage.
          frames.push({ ...picture(sample), requestedOffsetSeconds: offsets[nextOffset++] });
        }
        if (boundary !== null && sample.offsetSeconds >= 2.1) {
          stop();
          const pre = before.sort((a, b) => Math.abs(a.rafTimestamp - boundary + 500) - Math.abs(b.rafTimestamp - boundary + 500))[0];
          if (pre) frames.unshift({ ...pre, requestedOffsetSeconds: -0.5, offsetSeconds: (pre.rafTimestamp - boundary) / 1000 });
          Promise.all(frames.map(async ({ pngPromise, ...frame }) => ({ ...frame, png: await pngPromise })))
            .then(frames => resolve({ timeOrigin: performance.timeOrigin, boundaryRafTimestamp: boundary,
              fillBoundaryRafTimestamp: fillBoundary,
              capture: capturePixels ? 'same-rAF canvas snapshot, asynchronous PNG encoding, computed HUD opacity' : 'rAF diagnostic and computed HUD opacity', samples, frames }));
          return;
        }
        if (performance.now() - started > 120_000) throw new Error('station threshold not crossed within 120 seconds');
        requestAnimationFrame(tick);
      } catch (error) { stop(); reject(error); }
    };
    window.__spaceStationWalk?.(4.4, 0);
    requestAnimationFrame(tick);
  }), { capturePixels });
}

export function validateStationThreshold(record, { requireLowLine = false, reducedMotion = false } = {}) {
  const failures = [];
  const check = (ok, message) => { if (!ok) failures.push(message); };
  const samples = record.samples.filter(s => s.offsetSeconds !== null && s.offsetSeconds >= 0);
  check(samples.every(s => Number.isFinite(s.frameTimestampMs) && s.frameTimestampMs === s.rafTimestamp),
    'sampled fill belongs to the same actual animation frame');
  check(samples.length > 0 && samples[0].progress === 0 && samples[0].elapsedSeconds === 0, 'first concourse frame starts at progress zero');
  check(samples.every(s => s.district === 'concourse' && s.durationSeconds === 1.4), 'concourse destination and signed 1.4-second duration');
  check(samples.every((s, i) => s.progress >= 0 && s.progress <= 1 && (!i || s.progress >= samples[i - 1].progress)), 'monotone fill without overshoot');
  const at12 = samples.find(s => s.offsetSeconds >= 1.2);
  const at14 = samples.find(s => s.offsetSeconds >= 1.4);
  check(at12?.progress >= 0.95, 'fill progress at least 0.95 at first rendered frame after 1.2 seconds');
  check(at14?.progress === 1, 'fill progress exactly one at first rendered frame after 1.4 seconds');
  const pre = record.frames.find(f => f.requestedOffsetSeconds === -0.5);
  check(pre && Math.abs(pre.offsetSeconds + 0.5) <= 0.1, 'actual pre-threshold frame within 100 ms of -0.5 seconds');
  for (const offset of [0, 0.4, 0.8, 1.2, 1.4, 2]) {
    const frame = record.frames.find(f => f.requestedOffsetSeconds === offset);
    // More than one tenth of a second late is missing timing evidence; a later
    // PNG with a convenient nominal filename cannot turn it into a pass.
    check(frame && frame.offsetSeconds >= offset && frame.offsetSeconds - offset <= 0.1,
      `actual frame within 100 ms after requested +${offset.toFixed(1)} seconds`);
  }
  const low = samples.filter(s => s.lowLinePresent);
  if (requireLowLine) check(low.length > 0, 'story low line is present');
  if (low.length) {
    check(low.every(s => s.lowLineFrameTimestampMs === s.rafTimestamp),
      'low-line style was updated in the same actual animation frame');
    check(low.filter(s => s.offsetSeconds <= 0.8).every(s => s.lowLineOpacity === 0), 'low line remains hidden through actual +0.8 seconds');
    check(at12?.lowLineOpacity === 1, 'low line is fully visible at first rendered frame after +1.2 seconds');
    if (reducedMotion) check(low.every(s => s.lowLineOpacity === 0 || s.lowLineOpacity === 1), 'reduced-motion low line steps without fading');
  }
  return failures;
}
