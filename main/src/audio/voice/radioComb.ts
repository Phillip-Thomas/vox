import { VOICE_COMB_FB, VOICE_COMB_S } from './voiceGrammar.ts';

/** Shared institutional radio colour for narrator grains and lifecycle figures. */
export function connectRadioComb(context: BaseAudioContext, input: AudioNode, output: AudioNode, amount: number): () => void {
  const send = context.createGain(); send.gain.value = amount;
  const delay = context.createDelay(0.05); delay.delayTime.value = VOICE_COMB_S;
  const feedback = context.createGain(); feedback.gain.value = VOICE_COMB_FB;
  input.connect(send); send.connect(delay); delay.connect(feedback); feedback.connect(delay); delay.connect(output);
  return () => { send.disconnect(); delay.disconnect(); feedback.disconnect(); };
}
