export type SfxEvent =
  | 'jump'
  | 'land'
  | 'mine'
  | 'blocked'
  | 'boardShip'
  | 'exitShip'
  | 'shipLaunch'
  | 'shipLand'
  | 'shipCrash'
  | 'splashEnter'
  | 'splashExit';

interface ContinuousLoop {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

class SfxEngine {
  private context: AudioContext | null = null;
  private outputGain: GainNode | null = null;
  // Master lowpass spliced before destination: open (20kHz) on land so the dry
  // path is byte-identical, ramped down to a muffled cutoff underwater.
  private submergeFilter: BiquadFilterNode | null = null;
  private jetpack: ContinuousLoop | null = null;
  private shipThrust: ContinuousLoop | null = null;
  private volume = 0.78;
  private muted = false;

  async unlock(): Promise<void> {
    const context = this.ensureContext();
    if (!context) return;
    await context.resume();
    this.applyOutput(0.04);
  }

  setOutput(sfxVolume: number, muted: boolean): void {
    this.volume = clamp01(sfxVolume);
    this.muted = muted;
    this.applyOutput(0.12);
  }

  play(event: SfxEvent): void {
    const context = this.ensureContext();
    const output = this.outputGain;
    if (!context || !output) return;
    void context.resume();

    switch (event) {
      case 'jump':
        this.playTone({ type: 'triangle', from: 135, to: 260, duration: 0.14, gain: 0.035 });
        this.playNoise({ type: 'highpass', from: 320, to: 900, duration: 0.11, gain: 0.018 });
        break;
      case 'land':
        this.playTone({ type: 'sine', from: 86, to: 48, duration: 0.18, gain: 0.045 });
        this.playNoise({ type: 'lowpass', from: 360, to: 120, duration: 0.14, gain: 0.035 });
        break;
      case 'mine':
        this.playNoise({ type: 'bandpass', from: 1600, to: 700, duration: 0.09, gain: 0.04, q: 1.8 });
        this.playTone({ type: 'square', from: 190, to: 95, duration: 0.06, gain: 0.014 });
        break;
      case 'blocked':
        this.playTone({ type: 'triangle', from: 120, to: 70, duration: 0.1, gain: 0.03 });
        break;
      case 'boardShip':
        this.playTone({ type: 'sine', from: 420, to: 620, duration: 0.12, gain: 0.028 });
        this.playTone({ type: 'sine', from: 650, to: 840, duration: 0.1, gain: 0.018, delay: 0.08 });
        break;
      case 'exitShip':
        this.playTone({ type: 'sine', from: 620, to: 360, duration: 0.16, gain: 0.026 });
        break;
      case 'shipLaunch':
        this.playNoise({ type: 'lowpass', from: 320, to: 850, duration: 0.34, gain: 0.06 });
        this.playTone({ type: 'sine', from: 72, to: 110, duration: 0.28, gain: 0.04 });
        break;
      case 'shipLand':
        this.playTone({ type: 'sine', from: 95, to: 55, duration: 0.22, gain: 0.038 });
        this.playNoise({ type: 'lowpass', from: 260, to: 90, duration: 0.18, gain: 0.024 });
        break;
      case 'shipCrash':
        this.playTone({ type: 'sawtooth', from: 70, to: 32, duration: 0.34, gain: 0.09 });
        this.playNoise({ type: 'lowpass', from: 900, to: 110, duration: 0.3, gain: 0.08 });
        break;
      case 'splashEnter':
        // Plunge: a quick lowpass-swept gulp + a bubble burst, as the muffle clamps on.
        this.playNoise({ type: 'lowpass', from: 1400, to: 280, duration: 0.24, gain: 0.07 });
        this.playNoise({ type: 'bandpass', from: 800, to: 1700, duration: 0.18, gain: 0.03, q: 1.2 });
        break;
      case 'splashExit':
        // Surface: a brighter rising "gasp" as the muffle releases + droplets.
        this.playNoise({ type: 'highpass', from: 320, to: 1300, duration: 0.26, gain: 0.055 });
        this.playTone({ type: 'sine', from: 170, to: 330, duration: 0.18, gain: 0.02 });
        break;
    }
  }

  /**
   * Muffle the whole sfx bus underwater. `amount` 0 = open/dry, 1 = fully muffled.
   * Edge-driven by AudioDirector on submerge/emerge so the cutoff snaps (the
   * "clunk") on entry and releases (the "gasp") on exit.
   */
  setSubmerged(amount: number): void {
    const a = clamp01(amount);
    const context = this.ensureContext();
    if (!context || !this.submergeFilter) return;
    void context.resume();
    const cutoff = 20000 - a * (20000 - 560); // 20kHz (transparent) -> ~560Hz (muffled)
    rampParam(context, this.submergeFilter.frequency, cutoff, a > 0.5 ? 0.08 : 0.16);
  }

  setJetpackActive(active: boolean, intensity = 1): void {
    const amount = active ? clamp01(intensity) : 0;
    const loop = amount > 0 ? this.ensureLoop('jetpack') : this.jetpack;
    if (!loop || !this.context) return;
    rampGain(this.context, loop.gain.gain, amount * 0.075, amount > 0 ? 0.06 : 0.16);
    rampParam(this.context, loop.filter.frequency, 520 + amount * 920, 0.08);
  }

  setShipThrust(level: number): void {
    const amount = clamp01(level);
    const loop = amount > 0 ? this.ensureLoop('shipThrust') : this.shipThrust;
    if (!loop || !this.context) return;
    rampGain(this.context, loop.gain.gain, amount * 0.045, amount > 0 ? 0.08 : 0.18);
    rampParam(this.context, loop.filter.frequency, 240 + amount * 560, 0.1);
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.context) return this.context;

    const ContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!ContextCtor) return null;

    const context = new ContextCtor();
    const outputGain = context.createGain();
    outputGain.gain.value = this.muted ? 0 : this.volume;
    // Master muffle filter between the output bus and destination. Initialized
    // fully open (20kHz) so on land the chain is acoustically transparent.
    const submergeFilter = context.createBiquadFilter();
    submergeFilter.type = 'lowpass';
    submergeFilter.frequency.value = 20000;
    submergeFilter.Q.value = 0.7;
    outputGain.connect(submergeFilter);
    submergeFilter.connect(context.destination);
    this.context = context;
    this.outputGain = outputGain;
    this.submergeFilter = submergeFilter;
    return context;
  }

  private applyOutput(fadeSeconds: number): void {
    if (!this.context || !this.outputGain) return;
    rampGain(this.context, this.outputGain.gain, this.muted ? 0 : this.volume, fadeSeconds);
  }

  private ensureLoop(kind: 'jetpack' | 'shipThrust'): ContinuousLoop | null {
    const context = this.ensureContext();
    const output = this.outputGain;
    if (!context || !output) return null;
    void context.resume();

    const existing = kind === 'jetpack' ? this.jetpack : this.shipThrust;
    if (existing) return existing;

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = makeNoiseBuffer(context, 2.5);
    source.loop = true;
    filter.type = kind === 'jetpack' ? 'bandpass' : 'lowpass';
    filter.frequency.value = kind === 'jetpack' ? 520 : 240;
    filter.Q.value = kind === 'jetpack' ? 0.85 : 0.45;
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    source.start();

    const loop = { source, filter, gain };
    if (kind === 'jetpack') this.jetpack = loop;
    else this.shipThrust = loop;
    return loop;
  }

  private playTone(options: {
    type: OscillatorType;
    from: number;
    to: number;
    duration: number;
    gain: number;
    delay?: number;
  }): void {
    if (!this.context || !this.outputGain) return;
    const start = this.context.currentTime + (options.delay ?? 0);
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = options.type;
    osc.frequency.setValueAtTime(options.from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, options.to), start + options.duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(options.gain, start + options.duration * 0.18);
    gain.gain.linearRampToValueAtTime(0, start + options.duration);
    osc.connect(gain);
    gain.connect(this.outputGain);
    osc.start(start);
    osc.stop(start + options.duration);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  private playNoise(options: {
    type: BiquadFilterType;
    from: number;
    to: number;
    duration: number;
    gain: number;
    q?: number;
  }): void {
    if (!this.context || !this.outputGain) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = makeNoiseBuffer(this.context, Math.max(0.2, options.duration));
    filter.type = options.type;
    filter.frequency.setValueAtTime(options.from, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(1, options.to), now + options.duration);
    filter.Q.value = options.q ?? 0.75;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(options.gain, now + options.duration * 0.08);
    gain.gain.linearRampToValueAtTime(0, now + options.duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.outputGain);
    source.start(now);
    source.stop(now + options.duration);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function rampGain(context: AudioContext, param: AudioParam, value: number, fadeSeconds: number): void {
  rampParam(context, param, value, fadeSeconds);
}

function rampParam(context: AudioContext, param: AudioParam, value: number, fadeSeconds: number): void {
  const now = context.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(value, now + Math.max(0.01, fadeSeconds));
}

function makeNoiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const frameCount = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  let sample = 0;
  for (let i = 0; i < frameCount; i++) {
    sample = sample * 0.97 + (Math.random() * 2 - 1) * 0.03;
    data[i] = sample * 2.4;
  }
  return buffer;
}

let engine: SfxEngine | null = null;

export function getSfxEngine(): SfxEngine {
  engine ??= new SfxEngine();
  return engine;
}

export function unlockSfxAudio(): Promise<void> {
  return getSfxEngine().unlock();
}

export function playSfx(event: SfxEvent): void {
  getSfxEngine().play(event);
}

export function setJetpackSfx(active: boolean, intensity?: number): void {
  getSfxEngine().setJetpackActive(active, intensity);
}

export function setSubmergedSfx(amount: number): void {
  getSfxEngine().setSubmerged(amount);
}

export function setShipThrustSfx(level: number): void {
  getSfxEngine().setShipThrust(level);
}
