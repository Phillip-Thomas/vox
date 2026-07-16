// Scene-safe audiovisual cue rail.
//
// Story, score, and cinematography sign one anchor map. Runtime consumers sample
// this immutable rail instead of writing directly to camera/PostFX globals.

export type SceneAvCueChannel =
  | 'fov'
  | 'grade'
  | 'bloom'
  | 'outline'
  | 'underwater_medium'
  | 'flight_feedback';

export type SceneAvCueOwner =
  | 'story'
  | 'score'
  | 'cinematography'
  | 'player_medium'
  | 'vehicle';

export type SceneAvCueEasing = 'linear' | 'smoothstep' | 'ease_in' | 'ease_out';

export interface SceneAvAnchor {
  id: string;
  timeSeconds: number;
}

export interface SceneAvFallback {
  kind: 'emissive_pulse' | 'local_light_pulse' | 'material_shift';
  targetId: string;
}

export interface SceneAvCue {
  id: string;
  channel: SceneAvCueChannel;
  owner: SceneAvCueOwner;
  anchorId: string;
  offsetSeconds?: number;
  durationSeconds: number;
  from: number;
  to: number;
  easing?: SceneAvCueEasing;
  reducedMotion?: { from: number; to: number };
  /** Required whenever bloom communicates a timed punctuation. */
  noPostProcessFallback?: SceneAvFallback;
}

export interface SceneAvContract {
  sceneId: string;
  revision: string;
  anchors: SceneAvAnchor[];
  cues: SceneAvCue[];
}

export interface CompiledSceneAvCue extends SceneAvCue {
  startSeconds: number;
  endSeconds: number;
}

export interface CompiledSceneAvRail {
  sceneId: string;
  revision: string;
  cues: CompiledSceneAvCue[];
}

export interface SceneAvSample {
  cueId: string;
  channel: SceneAvCueChannel;
  owner: SceneAvCueOwner;
  amount: number;
  progress: number;
  fallback?: SceneAvFallback;
}

export interface SceneAvSampleOptions {
  reducedMotion?: boolean;
  postProcessAvailable?: boolean;
}

const CHANNELS = new Set<SceneAvCueChannel>([
  'fov',
  'grade',
  'bloom',
  'outline',
  'underwater_medium',
  'flight_feedback'
]);

export function compileSceneAvContract(contract: SceneAvContract): CompiledSceneAvRail {
  const sceneId = nonEmpty(contract.sceneId, 'sceneId');
  const revision = nonEmpty(contract.revision, 'revision');
  const anchors = new Map<string, number>();
  for (const anchor of contract.anchors) {
    const id = nonEmpty(anchor.id, 'anchor id');
    finite(anchor.timeSeconds, `anchor ${id} time`);
    if (anchor.timeSeconds < 0) throw new Error(`Anchor ${id} cannot precede scene time zero.`);
    if (anchors.has(id)) throw new Error(`Duplicate AV anchor: ${id}`);
    anchors.set(id, anchor.timeSeconds);
  }

  const ids = new Set<string>();
  const cues = contract.cues.map(cue => {
    const id = nonEmpty(cue.id, 'cue id');
    if (ids.has(id)) throw new Error(`Duplicate AV cue: ${id}`);
    ids.add(id);
    if (!CHANNELS.has(cue.channel)) throw new Error(`Unknown AV cue channel: ${cue.channel}`);
    const anchor = anchors.get(cue.anchorId);
    if (anchor === undefined) throw new Error(`Cue ${id} references unknown anchor ${cue.anchorId}.`);
    const offset = cue.offsetSeconds ?? 0;
    finite(offset, `cue ${id} offset`);
    finite(cue.durationSeconds, `cue ${id} duration`);
    finite(cue.from, `cue ${id} from`);
    finite(cue.to, `cue ${id} to`);
    if (cue.durationSeconds <= 0) throw new Error(`Cue ${id} duration must be positive.`);
    if (cue.reducedMotion) {
      finite(cue.reducedMotion.from, `cue ${id} reduced-motion from`);
      finite(cue.reducedMotion.to, `cue ${id} reduced-motion to`);
    }
    if (cue.channel === 'fov') {
      validateFov(cue.from, id);
      validateFov(cue.to, id);
      if (cue.reducedMotion) {
        validateFov(cue.reducedMotion.from, id);
        validateFov(cue.reducedMotion.to, id);
      }
    }
    if (cue.channel === 'bloom' && Math.max(cue.from, cue.to) > 0 && !cue.noPostProcessFallback) {
      throw new Error(`Bloom cue ${id} needs a no-postprocess fallback.`);
    }
    if (cue.noPostProcessFallback) nonEmpty(cue.noPostProcessFallback.targetId, `cue ${id} fallback target`);
    const startSeconds = anchor + offset;
    if (startSeconds < 0) throw new Error(`Cue ${id} cannot begin before scene time zero.`);
    return {
      ...cue,
      id,
      startSeconds,
      endSeconds: startSeconds + cue.durationSeconds,
      easing: cue.easing ?? 'smoothstep'
    };
  }).sort((left, right) => left.startSeconds - right.startSeconds || left.id.localeCompare(right.id));

  for (let index = 0; index < cues.length; index++) {
    const cue = cues[index]!;
    for (let nextIndex = index + 1; nextIndex < cues.length; nextIndex++) {
      const next = cues[nextIndex]!;
      if (next.startSeconds >= cue.endSeconds) break;
      if (next.channel === cue.channel) {
        throw new Error(
          `AV channel ${cue.channel} has overlapping owners/cues: ${cue.id} and ${next.id}.`
        );
      }
    }
  }

  return { sceneId, revision, cues };
}

export function sampleSceneAvRail(
  rail: CompiledSceneAvRail,
  timeSeconds: number,
  options: SceneAvSampleOptions = {}
): Partial<Record<SceneAvCueChannel, SceneAvSample>> {
  finite(timeSeconds, 'sample time');
  const output: Partial<Record<SceneAvCueChannel, SceneAvSample>> = {};
  for (const cue of rail.cues) {
    if (timeSeconds < cue.startSeconds || timeSeconds >= cue.endSeconds) continue;
    const rawProgress = (timeSeconds - cue.startSeconds) / cue.durationSeconds;
    const progress = ease(rawProgress, cue.easing ?? 'smoothstep');
    const range = options.reducedMotion && cue.reducedMotion
      ? cue.reducedMotion
      : cue;
    const postAvailable = options.postProcessAvailable ?? true;
    const fallback = !postAvailable && isPostProcessChannel(cue.channel)
      ? cue.noPostProcessFallback
      : undefined;
    output[cue.channel] = {
      cueId: cue.id,
      channel: cue.channel,
      owner: cue.owner,
      amount: lerp(range.from, range.to, progress),
      progress,
      ...(fallback ? { fallback } : {})
    };
  }
  return output;
}

export class SceneAvCueRailRuntime {
  private rail: CompiledSceneAvRail | null = null;

  load(contract: SceneAvContract): CompiledSceneAvRail {
    this.rail = compileSceneAvContract(contract);
    return this.rail;
  }

  sample(timeSeconds: number, options?: SceneAvSampleOptions) {
    return this.rail ? sampleSceneAvRail(this.rail, timeSeconds, options) : {};
  }

  reset(): void {
    this.rail = null;
  }

  identity(): Pick<CompiledSceneAvRail, 'sceneId' | 'revision'> | null {
    return this.rail ? { sceneId: this.rail.sceneId, revision: this.rail.revision } : null;
  }
}

function isPostProcessChannel(channel: SceneAvCueChannel): boolean {
  return channel === 'grade' || channel === 'bloom' || channel === 'outline';
}

function ease(value: number, easing: SceneAvCueEasing): number {
  const t = Math.max(0, Math.min(1, value));
  if (easing === 'linear') return t;
  if (easing === 'ease_in') return t * t;
  if (easing === 'ease_out') return 1 - (1 - t) * (1 - t);
  return t * t * (3 - 2 * t);
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function validateFov(value: number, cueId: string): void {
  if (value < 30 || value > 100) throw new Error(`FOV cue ${cueId} is outside the 30-100 degree envelope.`);
}

function finite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
}

function nonEmpty(value: string, label: string): string {
  const result = value.trim();
  if (!result) throw new Error(`${label} must not be empty.`);
  return result;
}
