// --- Music theory primitives (pure, no tuning constants, no I/O) --------------------------
//
// Pitch classes are semitones from A (0 = A, matching musicPrimitives' harmonic
// center, ROOT_HZ 55 = A1). Modes live on the standard brightness chain; chord
// vocabulary is the film-modal degree sets of PARAVOXIA_SCORE.md §6.3 (no
// functional dominants, no diminished triads). Neo-Riemannian P/L/R transforms
// give the chromatic-mediant language as short chains on the triad graph.

export type ModeName = 'phrygian' | 'aeolian' | 'dorian' | 'mixolydian' | 'ionian' | 'lydian';

/** Darkest → brightest; each neighbor is exactly ONE accidental apart (§6.2). */
export const MODE_BRIGHTNESS_CHAIN: readonly ModeName[] = [
  'phrygian', 'aeolian', 'dorian', 'mixolydian', 'ionian', 'lydian'
];

/** Scale intervals from the tonic, semitones. */
export const MODE_SCALES: Record<ModeName, readonly number[]> = {
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11]
};

export type ChordQuality = 'maj' | 'min';

export interface TriadSpec {
  /** Pitch class of the root, semitones from A, 0..11. */
  rootPc: number;
  quality: ChordQuality;
}

export const TRIAD_INTERVALS: Record<ChordQuality, readonly [number, number, number]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7]
};

export const pcMod = (n: number): number => ((n % 12) + 12) % 12;

export function triadPcs(t: TriadSpec): [number, number, number] {
  const iv = TRIAD_INTERVALS[t.quality];
  return [pcMod(t.rootPc + iv[0]), pcMod(t.rootPc + iv[1]), pcMod(t.rootPc + iv[2])];
}

export function triadId(t: TriadSpec): string {
  return `${pcMod(t.rootPc)}:${t.quality}`;
}

export interface ModeDegree {
  /** Degree root interval above the tonic, semitones. */
  root: number;
  quality: ChordQuality;
}

/**
 * Per-mode chord vocabulary (§6.3): modal/plagal sets, NO functional dominants,
 * NO diminished triads. Phrygian is drift-only territory (never home) but needs
 * a set for when high tension pulls the mode there; its ♭II IS the inflection.
 * Ionian is visited-only; its V is triad color only (never a 7th — enforced in
 * the color chooser).
 */
export const MODE_DEGREE_SETS: Record<ModeName, readonly ModeDegree[]> = {
  phrygian: [
    { root: 0, quality: 'min' },  // i
    { root: 1, quality: 'maj' },  // ♭II — the phrygian inflection
    { root: 3, quality: 'maj' },  // ♭III
    { root: 5, quality: 'min' },  // iv
    { root: 8, quality: 'maj' },  // ♭VI
    { root: 10, quality: 'min' }  // ♭vii
  ],
  aeolian: [
    { root: 0, quality: 'min' },  // i
    { root: 3, quality: 'maj' },  // ♭III
    { root: 8, quality: 'maj' },  // ♭VI
    { root: 10, quality: 'maj' }, // ♭VII
    { root: 5, quality: 'min' },  // iv
    { root: 7, quality: 'min' }   // v
  ],
  dorian: [
    { root: 0, quality: 'min' },  // i
    { root: 5, quality: 'maj' },  // IV — the Dorian sunbeam
    { root: 3, quality: 'maj' },  // ♭III
    { root: 10, quality: 'maj' }, // ♭VII
    { root: 7, quality: 'min' }   // v
  ],
  mixolydian: [
    { root: 0, quality: 'maj' },  // I
    { root: 10, quality: 'maj' }, // ♭VII
    { root: 5, quality: 'maj' },  // IV
    { root: 7, quality: 'min' },  // v
    { root: 2, quality: 'min' }   // ii
  ],
  ionian: [
    { root: 0, quality: 'maj' },  // I
    { root: 5, quality: 'maj' },  // IV
    { root: 9, quality: 'min' },  // vi
    { root: 4, quality: 'min' },  // iii
    { root: 7, quality: 'maj' }   // V — triad color only, never V7
  ],
  lydian: [
    { root: 0, quality: 'maj' },  // I
    { root: 2, quality: 'maj' },  // II — the Lydian lift
    { root: 4, quality: 'min' },  // iii
    { root: 9, quality: 'min' }   // vi
  ]
};

/**
 * Phrase-final bias targets (§6.5): tonic + plagal-side neighbors, per mode.
 * Degree-root intervals above the tonic; must be a subset of the mode's set.
 */
export const MODE_CADENCE_ROOTS: Record<ModeName, readonly number[]> = {
  phrygian: [0, 5, 8],
  aeolian: [0, 5, 8, 10],
  dorian: [0, 5, 10],
  mixolydian: [0, 5, 10],
  ionian: [0, 5, 9],
  lydian: [0, 2, 9]
};

export function degreeTriad(tonicPc: number, degree: ModeDegree): TriadSpec {
  return { rootPc: pcMod(tonicPc + degree.root), quality: degree.quality };
}

export function modeTonicTriad(tonicPc: number, mode: ModeName): TriadSpec {
  return degreeTriad(tonicPc, MODE_DEGREE_SETS[mode][0]);
}

export function isDiatonic(t: TriadSpec, tonicPc: number, mode: ModeName): boolean {
  const scale = new Set(MODE_SCALES[mode].map((iv) => pcMod(tonicPc + iv)));
  return triadPcs(t).every((pc) => scale.has(pc));
}

// --- Chord anchors (§7.1 anchor gene) --------------------------------------------------------

/** A chord tone a motif can anchor on (start / landing tone). */
export type ChordAnchor = 'root' | 'third' | 'fifth';

/** Pitch class of a chord anchor tone, semitones from A. */
export function chordAnchorPc(rootPc: number, quality: ChordQuality, anchor: ChordAnchor): number {
  switch (anchor) {
    case 'root': return pcMod(rootPc);
    case 'third': return pcMod(rootPc + (quality === 'maj' ? 4 : 3));
    case 'fifth': return pcMod(rootPc + 7);
  }
}

// --- Neo-Riemannian transforms and the triad (Tonnetz) graph -------------------------------

export type PlrOp = 'P' | 'L' | 'R';

/** P: parallel (Cmaj↔Cmin). R: relative (Cmaj↔Amin). L: leading-tone (Cmaj↔Emin). */
export function plrTransform(t: TriadSpec, op: PlrOp): TriadSpec {
  const major = t.quality === 'maj';
  switch (op) {
    case 'P':
      return { rootPc: t.rootPc, quality: major ? 'min' : 'maj' };
    case 'R':
      return major
        ? { rootPc: pcMod(t.rootPc + 9), quality: 'min' }
        : { rootPc: pcMod(t.rootPc + 3), quality: 'maj' };
    case 'L':
      return major
        ? { rootPc: pcMod(t.rootPc + 4), quality: 'min' }
        : { rootPc: pcMod(t.rootPc + 8), quality: 'maj' };
  }
}

const triadIndex = (t: TriadSpec): number => pcMod(t.rootPc) * 2 + (t.quality === 'maj' ? 1 : 0);

/** All-pairs PLR-graph distances over the 24 triads, BFS-precomputed at load. */
const TONNETZ_DIST: number[][] = (() => {
  const nodes: TriadSpec[] = [];
  for (let pc = 0; pc < 12; pc++) {
    nodes.push({ rootPc: pc, quality: 'min' });
    nodes.push({ rootPc: pc, quality: 'maj' });
  }
  const dist: number[][] = nodes.map(() => new Array<number>(24).fill(Infinity));
  for (let s = 0; s < 24; s++) {
    dist[s][s] = 0;
    const queue = [s];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const op of ['P', 'L', 'R'] as const) {
        const next = triadIndex(plrTransform(nodes[cur], op));
        if (dist[s][next] === Infinity) {
          dist[s][next] = dist[s][cur] + 1;
          queue.push(next);
        }
      }
    }
  }
  return dist;
})();

/** Minimal number of P/L/R moves between two triads. */
export function tonnetzDistance(a: TriadSpec, b: TriadSpec): number {
  return TONNETZ_DIST[triadIndex(a)][triadIndex(b)];
}

/**
 * ONE shortest P/L/R path from `a` to `b`, endpoints included (deterministic:
 * P-before-L-before-R expansion order). The pivot-chord walk of the approach
 * modulation (§8.4) rides this path — every step is a single P/L/R move, so
 * every step is automatically cheap under the §6.4 displacement law.
 */
export function tonnetzPath(a: TriadSpec, b: TriadSpec): TriadSpec[] {
  const start = triadIndex(a);
  const goal = triadIndex(b);
  const nodes: TriadSpec[] = [];
  for (let pc = 0; pc < 12; pc++) {
    nodes.push({ rootPc: pc, quality: 'min' });
    nodes.push({ rootPc: pc, quality: 'maj' });
  }
  const prev = new Array<number>(24).fill(-1);
  const seen = new Array<boolean>(24).fill(false);
  seen[start] = true;
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === goal) break;
    for (const op of ['P', 'L', 'R'] as const) {
      const next = triadIndex(plrTransform(nodes[cur], op));
      if (!seen[next]) {
        seen[next] = true;
        prev[next] = cur;
        queue.push(next);
      }
    }
  }
  const path: TriadSpec[] = [];
  for (let at = goal; at !== -1; at = prev[at]) {
    path.push(nodes[at]);
    if (at === start) break;
  }
  return path.reverse();
}

/**
 * Chromatic mediants of a triad (§6.3): mode-preserving third-related chords —
 * same quality, roots ±3 / ±4 semitones. All are PLR chains of length ≤ 2
 * (asserted in tests), so the same displacement-bounded legality governs them.
 */
export function chromaticMediants(t: TriadSpec): TriadSpec[] {
  return [-4, -3, 3, 4].map((step) => ({ rootPc: pcMod(t.rootPc + step), quality: t.quality }));
}
