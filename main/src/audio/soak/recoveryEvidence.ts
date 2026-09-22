import { createOfflineMusicRuntimeChain } from '../audioCore.ts';
import { renderDesignedSfx, sfxRecipe, type SfxEvent, type DesignedSfxOptions } from '../sfxEngine.ts';
import { SFX_CATEGORY } from '../mix/sfxCategories.ts';
import { analyzeLoudness, encodeWavPcm16 } from './audioAnalysis.ts';
import { renderVoiceInto } from '../voice/voiceBus.ts';
import type { VoiceRung } from '../voice/voiceGrammar.ts';
import { renderCombinedOffline } from './offlineRender.ts';
import { makeSoakScript } from '../generative/soak.ts';
import type { RoomPresetId } from '../mix/mixSnapshot.ts';

const SAMPLE_RATE = 44100;
function wavBase64(buffer: AudioBuffer): string {
  const bytes = new Uint8Array(encodeWavPcm16(Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i)), buffer.sampleRate));
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}
/** Energy-weighted short-time spectrum; fixed Hann window for all recipe A/Bs. */
function spectralFingerprint(channels: readonly Float32Array[], sampleRate: number) {
  const size = 1024, energy = new Float64Array(size / 2 + 1);
  for (let offset = 0; offset < channels[0].length; offset += size / 2) {
    const real = new Float64Array(size), imaginary = new Float64Array(size);
    for (let i = 0; i < size; i++) {
      for (const channel of channels) real[i] += (channel[offset + i] ?? 0) / channels.length;
      real[i] *= 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1));
    }
    for (let i = 1, j = 0; i < size; i++) {
      let bit = size >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) [real[i], real[j]] = [real[j], real[i]];
    }
    for (let length = 2; length <= size; length <<= 1) {
      for (let start = 0; start < size; start += length) for (let j = 0; j < length / 2; j++) {
        const angle = -2 * Math.PI * j / length, a = start + j, b = a + length / 2;
        const r = real[b] * Math.cos(angle) - imaginary[b] * Math.sin(angle);
        const im = real[b] * Math.sin(angle) + imaginary[b] * Math.cos(angle);
        real[b] = real[a] - r; imaginary[b] = imaginary[a] - im;
        real[a] += r; imaginary[a] += im;
      }
    }
    for (let i = 0; i < energy.length; i++) energy[i] += real[i] ** 2 + imaginary[i] ** 2;
  }
  const total = energy.reduce((sum, value) => sum + value, 0);
  const centroidHz = energy.reduce((sum, value, i) => sum + value * i * sampleRate / size, 0) / (total || 1);
  const bandwidthHz = Math.sqrt(energy.reduce((sum, value, i) => sum + value * (i * sampleRate / size - centroidHz) ** 2, 0) / (total || 1));
  return { centroidHz, bandwidthHz, windowSamples: size, hopSamples: size / 2 };
}
async function metrics(buffer: AudioBuffer) {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const wav = encodeWavPcm16(channels, buffer.sampleRate);
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', wav))].map(v => v.toString(16).padStart(2, '0')).join('');
  const rms = channels.map(channel => Math.sqrt(channel.reduce((sum, x) => sum + x * x, 0) / channel.length));
  let peak = 0, lastAudible = 0;
  for (const channel of channels) for (let i = 0; i < channel.length; i++) { peak = Math.max(peak, Math.abs(channel[i])); if (Math.abs(channel[i]) > 1e-5) lastAudible = Math.max(lastAudible, i / buffer.sampleRate); }
  return { hash, peak, rms, lastAudible, pan: rms[0] + rms[1] > 0 ? Math.atan2(rms[1], rms[0]) * 4 / Math.PI - 1 : 0, fingerprint: spectralFingerprint(channels, buffer.sampleRate), loudness: analyzeLoudness(channels, buffer.sampleRate) };
}

export async function renderSfxTrial(event: SfxEvent, ordinal = 1, design: DesignedSfxOptions = {}) {
  const seconds = Math.max(0.7, ...sfxRecipe(event).map(voice => (voice.delay ?? 0) + voice.duration + 0.2));
  const context = new OfflineAudioContext(2, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE);
  const mix = createOfflineMusicRuntimeChain(context);
  renderDesignedSfx(context, mix.sfx.input(SFX_CATEGORY[event]), event, 0.08, ordinal, 5, design);
  return metrics(await context.startRendering());
}

export async function renderRoomTrial(room: RoomPresetId, quality: 'full' | 'lean' = 'full') {
  const context = new OfflineAudioContext(2, SAMPLE_RATE * 6, SAMPLE_RATE);
  const mix = createOfflineMusicRuntimeChain(context);
  mix.sfx.setRoom?.(room, quality, 0);
  const source = context.createBufferSource();
  const impulse = context.createBuffer(1, 1, SAMPLE_RATE); impulse.getChannelData(0)[0] = 0.5;
  source.buffer = impulse; source.connect(mix.sfx.input('world')); source.start(1.5);
  const buffer = await context.startRendering();
  const samples = buffer.getChannelData(0);
  // Schroeder decay after the dry impulse/tail latency. Linear regression of
  // the -5..-35 dB energy segment gives a measured T30->RT60 estimate.
  const begin = Math.round(1.53 * SAMPLE_RATE), tail = new Float64Array(samples.length - begin);
  let energy = 0; for (let i = tail.length - 1; i >= 0; i--) { energy += samples[begin + i] ** 2; tail[i] = energy; }
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < tail.length; i += 32) { const db = 10 * Math.log10(tail[i] / (tail[0] || 1)); if (db < -5 && db > -35) { const x = i / SAMPLE_RATE; n++; sx += x; sy += db; sxx += x * x; sxy += x * db; } }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  return { room, quality, rt60: Number.isFinite(slope) && slope < 0 ? -60 / slope : null, samplesInFit: n, ...(await metrics(buffer)) };
}

export async function renderVoiceTrial(rung: VoiceRung, options: { sourceGain?: number; sustained?: boolean } = {}) {
  const text = options.sustained
    ? 'REGULATION ADVISORY. THE REQUEST EXCEEDS ENCLOSED CAPACITY. REMAIN WITHIN CAPACITY. ACKNOWLEDGE THE EXISTING WORK ORDER BEFORE PROCEEDING. NO FURTHER ACTION IS REQUIRED.'
    : 'REGULATION ADVISORY. REMAIN WITHIN CAPACITY.';
  const context = new OfflineAudioContext(2, SAMPLE_RATE * (options.sustained ? 6 : 4), SAMPLE_RATE);
  const mix = createOfflineMusicRuntimeChain(context);
  const voice = renderVoiceInto(context, mix.sfx.input('voice'), { text, rung, chord: { root: 0, chord: [0, 4, 7] }, startTime: 0.5, runSeed: 5, sourceGain: options.sourceGain });
  const buffer = await context.startRendering();
  voice.chain.disconnect();
  return { rung, fixture: options.sustained ? 'sustained-3s-active-voice' : 'short-line-and-silence', sourceGain: options.sourceGain ?? null, grains: voice.grainsScheduled, wavBase64: wavBase64(buffer), ...(await metrics(buffer)) };
}

export async function renderVoiceBloomTrial() {
  const seconds = 60;
  const script = makeSoakScript('sandboxDay', 5, seconds);
  const result = await renderCombinedOffline({ planetSeed: 5, archetype: 'verdant', scenario: 'sandboxDay', seconds, resetGlobalsBeforeRender: true,
    script: t => ({ ...script(t), era: 1, stage: 'alive', bloomBudget: 1, energy: t >= 24 && t < 32 ? 1 : script(t).energy }),
    sfxScript: [{ t: 27, event: 'shipCrash' }], hitCues: [{ atSec: 26, kind: 'bloom' }],
    voiceScript: [{ t: 25, text: 'REGULATION ADVISORY. THE REQUEST EXCEEDS ENCLOSED CAPACITY.', rung: 'alive' }] });
  return { analysis: result.analysis, wavBase64: wavBase64(result.buffer), ...(await metrics(result.buffer)) };
}
