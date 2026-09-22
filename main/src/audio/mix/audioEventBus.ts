import { AudioEventQueue, type AudioEvent, type PostVerdict } from './audioEventQueue.ts';

// --- The live audio event bus (thin rim over the pure queue) ---------------------------------------
//
// `postAudioEvent` is the single door every SFX trigger walks through. Events
// collect for the current animation frame and flush once, in a microtask at
// the end of the posting task — so a trigger sounds in the same frame it was
// asked for (no added latency) while forty same-frame posts collapse to one
// and a held level sounds only on its rising edge (see audioEventQueue.ts).
// The frame counter is one requestAnimationFrame callback that increments an
// integer; it writes nothing and allocates nothing per frame.

type AudioEventHandler = (event: AudioEvent) => void;

const queue = new AudioEventQueue();
const handlers = new Set<AudioEventHandler>();
let frame = 0;
let frameClockArmed = false;
let flushArmed = false;
/** Tests drive the frame explicitly; the rAF clock stays off when this is set. */
let manualFrame: number | null = null;

function armFrameClock(): void {
  if (frameClockArmed || manualFrame != null) return;
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return;
  frameClockArmed = true;
  const tick = (): void => {
    frame++;
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}

function flush(): void {
  flushArmed = false;
  const events = queue.flush();
  for (const event of events) {
    for (const handler of handlers) handler(event);
  }
}

/** Subscribe to flushed (admitted, deduped) events. Returns the unsubscribe. */
export function onAudioEvent(handler: AudioEventHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

/** Post one event for this frame. The verdict says whether it will flush. */
export function postAudioEvent(event: AudioEvent): PostVerdict {
  armFrameClock();
  const verdict = queue.post(event, manualFrame ?? frame);
  if (verdict === 'queued' && !flushArmed) {
    flushArmed = true;
    if (typeof queueMicrotask === 'function') queueMicrotask(flush);
    else void Promise.resolve().then(flush);
  }
  return verdict;
}

/** Test seam: pin the frame number (null returns control to the rAF clock). */
export function setAudioEventFrameForTests(next: number | null): void {
  manualFrame = next;
}

/** Test seam: flush synchronously instead of waiting for the microtask. */
export function flushAudioEventsNow(): void {
  flush();
}
