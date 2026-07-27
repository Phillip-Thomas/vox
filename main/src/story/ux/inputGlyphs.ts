// --- Input glyph presentation -------------------------------------------------
//
// One place that translates the authored keyboard tokens ([F], [SPACE], …) into
// the labels a touch player actually sees on the mounted controls. Authored copy
// keeps the keyboard names (they are the desktop truth); this is a presentation
// pass applied at RENDER time, per surface, only when `touch` is true.
//
// Contexts exist because the same key means different things per era:
//   - 'embodied': the free/awakened on-foot + jetpack HUD (the original table).
//     [SPACE] is the jetpack lift → THRUST; [E] is the hand extractor → MINE.
//   - 'feed':     the regulation-feed era. Movement is the d-pad (arrows) and an
//     EXTRACT button; [SPACE] is the on-foot JUMP, not flight thrust.
//   - 'prologue': the full-screen terminal advance prompts and the deflection
//     minigame, where the affordance is a tap or a drag, not a labelled button.
//
// Adding a context or token here is the ONLY sanctioned way to give a leaked
// keyboard prompt a mobile variant — never fork the substitution logic.

export type InputGlyphContext = 'embodied' | 'feed' | 'prologue';

type TokenTable = ReadonlyArray<readonly [RegExp, string]>;

// The awakened/free HUD. Kept byte-identical to the original StoryGuidanceHud
// table (its callers and tests depend on exactly these), plus the two tokens
// the awakened captions need ([SHIFT] run cue, [M] chart hint) — no existing
// embodied string contains those, so existing output is unchanged.
const EMBODIED_TOKENS: TokenTable = [
  [/\[SPACE\]/g, '[THRUST]'],
  [/\[F\]/g, '[USE]'],
  [/\[G\]/g, '[CONSUME]'],
  [/\[E\]/g, '[MINE]'],
  [/\[C\]/g, '[FABRICATOR]'],
  [/\[B\]/g, '[BUILD]'],
  [/\[M\]/g, '[CHART]'],
  [/\[SHIFT\]/g, '[SPRINT]']
];

// The regulation-feed era. Movement is the on-screen d-pad (arrow glyphs), the
// harvest key is the EXTRACT button, and [SPACE] is the on-foot JUMP. Single-key
// substitutions compose the combined "[A]/[D]" and "[W]/[S]" forms on their own.
const FEED_TOKENS: TokenTable = [
  [/\[A\]/g, '[◀]'], // ◀
  [/\[D\]/g, '[▶]'], // ▶
  [/\[W\]/g, '[▲]'], // ▲
  [/\[S\]/g, '[▼]'], // ▼
  [/\[SPACE\]/g, '[JUMP]'],
  [/\[E\]/g, '[EXTRACT]'],
  [/\[F\]/g, '[USE]'],
  [/\[G\]/g, '[CONSUME]'],
  [/\[C\]/g, '[FABRICATOR]'],
  [/\[B\]/g, '[BUILD]'],
  [/\[M\]/g, '[CHART]'],
  [/\[SHIFT\]/g, '[SPRINT]']
];

// Full-screen terminal prompts. The deflection subtitle collapses to its drag
// instruction (owner-approved phrasing); any leading advance key ([F]/[TAB]/
// [ENTER] …) on a full-screen prompt becomes a tap instruction.
const PROLOGUE_TOKENS: TokenTable = [
  [/VECTOR THE INTAKE SHIELD .*\[W\]\/\[S\]/g, 'DRAG TO VECTOR THE INTAKE SHIELD'],
  [/^\[(?:F|TAB|ENTER|SPACE)\]\s+/g, 'TAP TO ']
];

const TOKEN_TABLES: Record<InputGlyphContext, TokenTable> = {
  embodied: EMBODIED_TOKENS,
  feed: FEED_TOKENS,
  prologue: PROLOGUE_TOKENS
};

export interface PresentInputGlyphsOptions {
  /**
   * Whether the survey-chart token ([M]) may be presented as an actionable
   * [CHART] button. Default true. Pass false on touch surfaces where the chart
   * is NOT openable at that moment (e.g. the ch1-nav "retained as SURVEY CHART"
   * flavor line): the token is stripped so it never reads as a live control the
   * player has no way to press. Desktop output is untouched either way.
   */
  chartActionable?: boolean;
}

// A chart token with its leading whitespace, so stripping "SURVEY CHART [M]."
// yields "SURVEY CHART." with no stray space before the period.
const CHART_TOKEN_WITH_SPACE = /\s*\[M\]/g;

/**
 * Present one authored line for the given surface. On desktop the line is
 * returned untouched; on touch the context's token table is applied in order.
 */
export function presentInputGlyphs(
  line: string,
  touch: boolean,
  context: InputGlyphContext = 'embodied',
  options: PresentInputGlyphsOptions = {}
): string {
  if (!touch) return line;
  // Drop the chart token BEFORE the table runs, so its [M] → [CHART] rule finds
  // nothing to actionize on a surface where the chart cannot be opened.
  const source = options.chartActionable === false
    ? line.replace(CHART_TOKEN_WITH_SPACE, '')
    : line;
  return TOKEN_TABLES[context].reduce(
    (presented, [token, label]) => presented.replace(token, label),
    source
  );
}

/**
 * The embodied-HUD presenter. Retained as a named export so the awakened story
 * guidance HUD and its tests keep their exact call site and behavior.
 */
export function presentStoryGuidanceLine(line: string, touch: boolean): string {
  return presentInputGlyphs(line, touch, 'embodied');
}
