// Story-forced day phase, kept in its own tiny module so SkyController's only
// story dependency is this getter (no director/store imports in the sky path).
//
// null = the cycle runs normally. The story director uses this to hold the sun at
// regulation noon after A2, slide it through the first dusk, then release it to
// the live world clock (see storyDirector).

let storyForcedDayPhase: number | null = null;

export function getStoryForcedDayPhase(): number | null {
  return storyForcedDayPhase;
}

export function setStoryForcedDayPhase(phase: number | null): void {
  storyForcedDayPhase = phase == null || !Number.isFinite(phase)
    ? null
    : ((phase % 1) + 1) % 1;
}
