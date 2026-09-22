// Stage 3 MOODS-as-constraints evidence (pure): for every authored mood entry,
// the literal progression versus the brain voicing under the entry's policy —
// per-change max voice displacement before/after, pitch-class superset, bass =
// root, tight-interval preservation, and the a4 order. Run with vite-node:
//   npx vite-node tools/mood-voicing-evidence.ts > evidence/stage-3/mood-voicing.json
import {
  chordPitchClasses,
  deriveMoodConstraint,
  resolveMoodVoicingSequence,
  tightIntervals,
  voiceDisplacement
} from '../src/audio/generative/moodConstraint.ts';
import {
  listStoryScoreMoodInventory,
  MOOD_DEFAULT_VOICING,
  resolveMoodVoicingPolicy
} from '../src/story/storyScore.ts';

const PAD_VOICES = 4;
const rows = listStoryScoreMoodInventory().map((entry) => {
  const policy = resolveMoodVoicingPolicy(entry.beat);
  const literalC = deriveMoodConstraint(entry.mood, 0, 'literal', PAD_VOICES);
  const brainC = deriveMoodConstraint(entry.mood, 0, policy, PAD_VOICES);
  // Two full cycles: the wrap (last → first) is a change the live scheduler makes.
  const literal = resolveMoodVoicingSequence(literalC, 2);
  const voiced = resolveMoodVoicingSequence(brainC, 2);
  const perChange = literal.slice(1).map((_, k) => {
    const i = k;
    const j = k + 1;
    return {
      from: i,
      to: j,
      literalMax: voiceDisplacement(literal[i].slice(1, PAD_VOICES), literal[j].slice(1, PAD_VOICES)).max,
      brainMax: voiceDisplacement(voiced[i].slice(1, PAD_VOICES), voiced[j].slice(1, PAD_VOICES)).max,
      literalTotal: voiceDisplacement(literal[i].slice(1, PAD_VOICES), literal[j].slice(1, PAD_VOICES)).total,
      brainTotal: voiceDisplacement(voiced[i].slice(1, PAD_VOICES), voiced[j].slice(1, PAD_VOICES)).total
    };
  });
  const pcsKept = voiced.every((v, i) => chordPitchClasses(v).join(',') === chordPitchClasses(literal[i]).join(','));
  const bassKept = voiced.every((v, i) => v[0] === literal[i][0]);
  const tightKept = voiced.every((v, i) =>
    tightIntervals(v.slice(0, PAD_VOICES)).join(',') === tightIntervals(literal[i].slice(0, PAD_VOICES)).join(',')
  );
  const changed = voiced.some((v, i) => v.join(',') !== literal[i].join(','));
  const chords = literalC.chordSequence.length;
  return {
    name: entry.name,
    beat: entry.beat,
    policy,
    effectivePolicy: brainC.voicingPolicy,
    brainGuard: brainC.brainGuard,
    chords,
    changed,
    maxVoiceDisplacementBefore: Math.max(0, ...perChange.map((c) => c.literalMax)),
    maxVoiceDisplacementAfter: Math.max(0, ...perChange.map((c) => c.brainMax)),
    totalDisplacementBefore: perChange.reduce((a, c) => a + c.literalTotal, 0),
    totalDisplacementAfter: perChange.reduce((a, c) => a + c.brainTotal, 0),
    neverWorsePerChange: perChange.every((c) => c.brainMax <= c.literalMax),
    pitchClassSetKept: pcsKept,
    bassRootKept: bassKept,
    tightIntervalsKept: tightKept,
    literal,
    voiced,
    perChange
  };
});

const progressionRows = rows.filter((r) => r.chords > 1);
const brainRows = progressionRows.filter((r) => r.policy === 'brain');
const guarded = brainRows.filter((r) => r.effectivePolicy === 'literal');
const summary = {
  generatedAt: new Date().toISOString(),
  defaultPolicy: MOOD_DEFAULT_VOICING,
  moods: rows.length,
  withProgression: progressionRows.length,
  brainVoiced: brainRows.length,
  changedByBrain: brainRows.filter((r) => r.changed).length,
  demotedByGainGuard: guarded.map((r) => ({ name: r.name, reason: r.brainGuard })),
  literalOrOverride: rows.length - brainRows.length,
  allPitchClassSetsKept: rows.every((r) => r.pitchClassSetKept),
  allBassRootsKept: rows.every((r) => r.bassRootKept),
  allTightIntervalsKept: rows.every((r) => r.tightIntervalsKept),
  maxVoiceDisplacementBefore: Math.max(0, ...progressionRows.map((r) => r.maxVoiceDisplacementBefore)),
  maxVoiceDisplacementAfter: Math.max(0, ...progressionRows.map((r) => r.maxVoiceDisplacementAfter)),
  meanMaxDisplacementBefore: progressionRows.reduce((a, r) => a + r.maxVoiceDisplacementBefore, 0) / Math.max(1, progressionRows.length),
  meanMaxDisplacementAfter: progressionRows.reduce((a, r) => a + r.maxVoiceDisplacementAfter, 0) / Math.max(1, progressionRows.length),
  neverWorse: progressionRows.every((r) => r.neverWorsePerChange),
  totalDisplacementBefore: progressionRows.reduce((a, r) => a + r.totalDisplacementBefore, 0),
  totalDisplacementAfter: progressionRows.reduce((a, r) => a + r.totalDisplacementAfter, 0),
  rows
};
process.stdout.write(JSON.stringify(summary, null, 2));
