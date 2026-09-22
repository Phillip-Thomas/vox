import type { MixBus } from './mixTuning.ts';

// --- Per-frame audio event queue (pure) ------------------------------------------------------------------
//
// Call sites post events; the queue collects them for one frame and flushes
// once. Two structural laws replace the level-vs-edge discipline that call
// sites used to be trusted with:
//   1. (id, frame) dedupe — forty nodes mined in one frame is one chip.
//   2. Held-level law — an id posted in two CONSECUTIVE frames is a level, not
//      an edge; only the first frame of the run sounds. A gap of one frame or
//      more begins a new edge.
// The rate limiter and its loop guard remain the backstop behind this, with
// unchanged thresholds.

export interface AudioEvent {
  id: string;
  category: MixBus;
  priority: number;
  params?: Record<string, number>;
  position?: { x: number; y: number; z: number };
  material?: string;
}

export type PostVerdict = 'queued' | 'dedupe-same-frame' | 'held-level';

export class AudioEventQueue {
  private pending: Array<{ event: AudioEvent; order: number }> = [];
  private readonly queuedThisFrame = new Set<string>();
  private readonly lastPostedFrame = new Map<string, number>();
  private frame = Number.NEGATIVE_INFINITY;
  private order = 0;

  /** Post one event for `frame`; returns why it was or was not queued. */
  post(event: AudioEvent, frame: number): PostVerdict {
    if (frame !== this.frame) {
      // A new frame with unflushed events: the caller's flush is late; keep them.
      this.frame = frame;
      this.queuedThisFrame.clear();
    }
    const previous = this.lastPostedFrame.get(event.id);
    this.lastPostedFrame.set(event.id, frame);
    if (this.queuedThisFrame.has(event.id)) return 'dedupe-same-frame';
    if (previous !== undefined && previous === frame - 1) return 'held-level';
    this.queuedThisFrame.add(event.id);
    this.pending.push({ event, order: this.order++ });
    return 'queued';
  }

  /** Take every queued event, highest priority first (stable within a priority). */
  flush(): AudioEvent[] {
    if (this.pending.length === 0) return [];
    const out = this.pending
      .sort((a, b) => b.event.priority - a.event.priority || a.order - b.order)
      .map((p) => p.event);
    this.pending = [];
    this.queuedThisFrame.clear();
    return out;
  }

  get size(): number {
    return this.pending.length;
  }
}
