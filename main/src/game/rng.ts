// --- Simulation RNG seam -----------------------------------------------------
//
// Shared-state mutations should receive randomness from command context. Offline
// single-player can use the local default, but server-side multiplayer will pass
// an authoritative per-command RNG.

const UINT32_RANGE = 4294967296;
const DEFAULT_STATE = 0x6d2b79f5;

export interface SimulationRng {
  readonly seed: number;
  next(): number;
  int(minInclusive: number, maxInclusive: number): number;
  chance(probability: number): boolean;
}

export function hashRngSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeSeed(seed: number | string): number {
  if (typeof seed === 'string') return hashRngSeed(seed);
  if (!Number.isFinite(seed)) return DEFAULT_STATE;
  return seed >>> 0;
}

function mixSeed(seed: number | string, salt: number | string = 0): number {
  const base = normalizeSeed(seed);
  const saltValue = normalizeSeed(salt);
  let mixed = (base ^ Math.imul(saltValue || DEFAULT_STATE, 2246822519)) >>> 0;
  mixed = Math.imul(mixed ^ (mixed >>> 16), 3266489917) >>> 0;
  return mixed || DEFAULT_STATE;
}

export function createSimulationRng(seed: number | string, salt: number | string = 0): SimulationRng {
  const initialSeed = mixSeed(seed, salt);
  let state = initialSeed;
  const rng: SimulationRng = {
    seed: initialSeed,
    next() {
      // Mulberry32: tiny, deterministic, sufficient for gameplay rolls.
      state = (state + DEFAULT_STATE) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
    },
    int(minInclusive: number, maxInclusive: number) {
      const lo = Math.ceil(Math.min(minInclusive, maxInclusive));
      const hi = Math.floor(Math.max(minInclusive, maxInclusive));
      if (hi <= lo) return lo;
      return lo + Math.floor(rng.next() * (hi - lo + 1));
    },
    chance(probability: number) {
      if (probability <= 0) return false;
      if (probability >= 1) return true;
      return rng.next() < probability;
    }
  };
  return rng;
}

export function createLocalEntropySeed(label = 'local'): number {
  let cryptoPart = 0;
  try {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi?.getRandomValues) {
      const values = new Uint32Array(1);
      cryptoApi.getRandomValues(values);
      cryptoPart = values[0] ?? 0;
    }
  } catch {
    cryptoPart = 0;
  }
  const perf = typeof performance !== 'undefined' ? performance.now() : 0;
  return hashRngSeed(`${label}:${Date.now()}:${perf}:${cryptoPart}`);
}

export function createLocalSimulationRng(label = 'local'): SimulationRng {
  return createSimulationRng(createLocalEntropySeed(label), label);
}

export const defaultSimulationRng = createSimulationRng('paravoxia:offline-simulation');
