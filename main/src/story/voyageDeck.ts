// --- The voyage deck engine ----------------------------------------------------------
//
// Pure (rng-injectable, unit-tested) branching-card engine for the Oregon Trail
// act. A run = the SPINE cards (always, in order) interleaved with a random
// draw from the POOL, plus FOLLOW-UP cards injected by chosen options
// (`unlocks`) — capped so pacing holds. Effects are applied by the caller
// (VoyageLedger) through existing systems so persistence is free.

export interface VoyageEffects {
  /** Inventory grants at the moment of choice (persist via the normal save). */
  items?: ReadonlyArray<{ id: string; qty: number }>;
  /** Harvester cell delta (starting charge is 100; damage subtracts). */
  mawCharge?: number;
  /** Vitals nudges applied on arrival (hunger / water points). */
  food?: number;
  water?: number;
}

export interface VoyageCardOption {
  id: string;
  label: string;
  echoLineId: string;
  ledgerDelta?: Partial<Record<'rations' | 'hull' | 'compliance', number>>;
  effects?: VoyageEffects;
  /** Follow-up card ids injected into the queue when this option is chosen. */
  unlocks?: readonly string[];
}

export interface VoyageCard {
  id: string;
  title: string;
  body: string;
  options: readonly VoyageCardOption[];
}

export interface VoyageDeck {
  /** Always drawn, in order (the run's narrative spine). */
  spine: readonly string[];
  /** Random-draw situational cards (poolDraws of these per run). */
  pool: readonly string[];
  /** How many pool cards a run draws. */
  poolDraws: number;
  /** Hard cap on total cards (spine + pool + follow-ups); the bridge is extra. */
  maxCards: number;
  /** The final card (the nav anomaly → the Pong order). Always last. */
  bridge: string;
  cards: Readonly<Record<string, VoyageCard>>;
}

export interface DeckRun {
  /** Card ids still to be shown (bridge NOT included; it caps the run). */
  queue: string[];
  drawn: string[];
}

export function createDeckRun(deck: VoyageDeck, rng: () => number = Math.random): DeckRun {
  const pool = [...deck.pool];
  const drawnPool: string[] = [];
  for (let i = 0; i < deck.poolDraws && pool.length > 0; i++) {
    const pick = Math.floor(rng() * pool.length);
    drawnPool.push(pool.splice(pick, 1)[0]);
  }
  // Interleave: spine anchors the arc; pool cards slot between spine cards.
  const queue: string[] = [];
  const spine = [...deck.spine];
  while (spine.length || drawnPool.length) {
    if (spine.length) queue.push(spine.shift()!);
    if (drawnPool.length) queue.push(drawnPool.shift()!);
  }
  return { queue, drawn: [] };
}

/** The next card to show, or null when only the bridge remains. */
export function nextCard(run: DeckRun, deck: VoyageDeck): VoyageCard | null {
  const id = run.queue.shift();
  if (!id) return null;
  run.drawn.push(id);
  return deck.cards[id] ?? null;
}

/**
 * Record a choice: injects the option's follow-ups (front of queue, so
 * consequences arrive while the cause is fresh) unless the cap is reached.
 */
export function applyChoice(run: DeckRun, deck: VoyageDeck, cardId: string, optionId: string): VoyageCardOption | null {
  const option = deck.cards[cardId]?.options.find(o => o.id === optionId) ?? null;
  if (!option) return null;
  for (const unlocked of option.unlocks ?? []) {
    if (run.drawn.length + run.queue.length >= deck.maxCards) break;
    if (!run.drawn.includes(unlocked) && !run.queue.includes(unlocked) && deck.cards[unlocked]) {
      run.queue.unshift(unlocked);
    }
  }
  return option;
}
