import { getFeedRuntime } from '../feedRuntime.ts';
import { setSurveyTargetPresentation } from './surveyBrackets.ts';
import { presentRegulationObjective } from './regulationVoice.ts';
import { presentInputGlyphs } from '../ux/inputGlyphs.ts';
const hudTest = vi.hoisted(() => ({
  capture: false, refs: [] as { current: unknown }[], effects: [] as (() => void | (() => void))[],
  voice: vi.fn(), consume: vi.fn(), retire: vi.fn(), reservations: [] as { id: string; left: number; right: number; top: number; bottom: number; width: number; height: number }[]
}));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useRef: (value: unknown) => { const ref = actual.useRef(value); if (hudTest.capture) hudTest.refs.push(ref); return ref; },
    useLayoutEffect: (effect: () => void | (() => void), deps: unknown[]) => hudTest.capture ? hudTest.effects.push(effect) : actual.useLayoutEffect(effect, deps) };
});
vi.mock('../storyState.ts', async importOriginal => {
  const actual = await importOriginal<typeof import('../storyState.ts')>();
  return { ...actual, useStoryState: () => hudTest.capture ? { ...actual.getStoryStateSnapshot(), active: true, beat: 'ch1-fixed' } : actual.useStoryState() };
});
vi.mock('../ux/storyHudLayout.ts', async importOriginal => {
  const actual = await importOriginal<typeof import('../ux/storyHudLayout.ts')>();
  return { ...actual, readStoryHudSafeAreaInsets: () => hudTest.capture ? { left: 0, right: 0, top: 0, bottom: 0 } : actual.readStoryHudSafeAreaInsets(),
    readEarlyFeedReservations: () => hudTest.capture ? hudTest.reservations : actual.readEarlyFeedReservations() };
});
vi.mock('../../audio/voice/voicePresentation.ts', async importOriginal => {
  const actual = await importOriginal<typeof import('../../audio/voice/voicePresentation.ts')>();
  return { ...actual, voiceVisibleText: hudTest.voice, consumeVoiceLineSilently: hudTest.consume, retireVisibleVoiceLine: hudTest.retire };
});
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setInteraction } from '../../game/systems/interactionSystem.ts';
import { clearStoryText } from '../storyText.ts';
import {
  activateGuidedStoryObjective,
  getGuidedObjectivePresentationState,
  clearGuidedStoryObjective,
  observeGuidedStoryMarker
} from '../ux/objectiveDirector.ts';
import RegulationFeedHud from './RegulationFeedHud.tsx';

vi.mock('../../audio/sfxEngine.ts', () => ({ playSfx: vi.fn() }));

beforeEach(() => { hudTest.refs = []; hudTest.effects = []; hudTest.reservations = []; hudTest.voice.mockClear(); hudTest.consume.mockClear(); hudTest.retire.mockClear(); });
afterEach(() => {
  hudTest.capture = false; setSurveyTargetPresentation(null); vi.unstubAllGlobals();
  clearGuidedStoryObjective();
  clearStoryText();
  setInteraction(null);
});

describe('regulation feed objective presentation', () => {
  it('exposes the pre-embodiment work order through the shared objective contract', () => {
    activateGuidedStoryObjective({
      id: 'ch1:depth:recover-pods',
      kind: 'travel',
      markerLabel: 'SUPPLY POD',
      workOrder: ['FOLLOW THE SUPPLY POD MARKER.', 'RECOVER THE PROJECTED POD.']
    });
    observeGuidedStoryMarker('SUPPLY POD');

    const markup = renderToStaticMarkup(<RegulationFeedHud />);
    expect(markup).toContain('aria-label="Current story objective"');
    expect(markup).toContain('data-objective-id="ch1:depth:recover-pods"');
    expect(markup).toContain('data-objective-marker-label="SUPPLY POD"');
    expect(markup).toContain('data-objective-health="ready"');
    expect(markup).toContain('data-objective-requires-marker="true"');
    expect(markup).toContain('RECOVER THE PROJECTED POD.');
    expect(markup).toContain('data-regulation-objective-marker="true"');
  });

  it('retains feed and redaction chrome while yielding objective and marker ownership', () => {
    activateGuidedStoryObjective({
      id: 'ch1:anomaly:classify',
      kind: 'interact',
      markerLabel: 'UNCHARTED MASS',
      workOrder: ['FOLLOW THE SURVEY MARKER.', '[F] CLASSIFY THE UNCHARTED MASS.']
    });

    const markup = renderToStaticMarkup(
      <RegulationFeedHud embodiedGuidanceActive />
    );
    expect(markup).toContain('data-regulation-feed-chrome="true"');
    expect(markup).toContain('data-redaction-box="true"');
    expect(markup).toContain('data-redaction-indicator="true"');
    expect(markup).not.toContain('aria-label="Current story objective"');
    expect(markup).not.toContain('data-regulation-objective-marker="true"');
    expect(markup).not.toContain('[F] CLASSIFY THE UNCHARTED MASS.');
  });

  it('publishes the same primary prompt contract under the regulation owner', () => {
    setInteraction({ id: 'story-anomaly', verb: 'Touch' });

    const markup = renderToStaticMarkup(<RegulationFeedHud />);
    expect(markup).toContain('id="paravoxia-primary-interaction-prompt"');
    expect(markup).toContain('data-interaction-prompt="primary"');
    expect(markup).toContain('data-interaction-id="story-anomaly"');
    expect(markup).toContain('data-interaction-owner="regulation-feed"');
    expect(markup.match(/data-interaction-prompt=/g)).toHaveLength(1);
  });
});


function mountEarlyOrder(mode: 'visible' | 'offscreen' | 'unresolved', nativeActionable = false) {
  activateGuidedStoryObjective({ id: 'ch1:fixed:calibrate-extractor', kind: 'interact', markerLabel: 'BIOFIBER', workOrder: ['HOLD [E] TO HARVEST BIOFIBER.'], requiresMarker: false });
  const state = getGuidedObjectivePresentationState();
  const snapshot = { ...state, objective: state.objective!, objectiveId: state.objective!.id, geometry: 'camera-epoch-1', frame: 1, viewportWidth: 390, viewportHeight: 844,
    rect: { left: 160, right: 260, top: 200, bottom: 246 }, targetKey: 'v:1,2,3', targetLabel: 'BIOFIBER', nativeActionable, horizontalOffscreen: mode === 'offscreen', direction: mode === 'offscreen' ? 'D' as const : null, fit: mode };
  setSurveyTargetPresentation(snapshot, true);
  hudTest.capture = true;
  renderToStaticMarkup(<RegulationFeedHud />);
  const line = { textContent: 'HOLD [E] TO HARVEST BIOFIBER.', clientWidth: 354, scrollWidth: 250 };
  const order = { style: {} as Record<string, string>, dataset: {} as Record<string, string>, scrollHeight: 20, clientHeight: 20,
    querySelector: () => line, getBoundingClientRect: () => ({ left: Number.parseFloat(order.style.left ?? '18'), top: Number.parseFloat(order.style.top ?? '26'),
      right: Number.parseFloat(order.style.left ?? '18') + Number.parseFloat(order.style.width ?? '354'), bottom: Number.parseFloat(order.style.top ?? '26') + 20,
      width: Number.parseFloat(order.style.width ?? '354'), height: 20 }) };
  hudTest.refs[3].current = order;
  const frames: (() => void)[] = [];
  vi.stubGlobal('window', { innerWidth: 390, innerHeight: 844 });
  vi.stubGlobal('document', { hidden: false, hasFocus: () => true });
  vi.stubGlobal('getComputedStyle', () => ({ display: 'block', visibility: 'visible', opacity: '1' }));
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { frames.push(callback); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  getFeedRuntime().treatment = 1;
  const cleanup = hudTest.effects[0]();
  return { order, line, snapshot, next: () => frames.shift()!(), cleanup };
}
describe('the mounted early work-order presentation loop', () => {
  it('voices an eligible canonical only after its first presentation and retires that exact token on a silent bearing replacement', () => {
    const run = mountEarlyOrder('visible');
    expect(hudTest.voice).not.toHaveBeenCalled(); run.next();
    expect(hudTest.voice).toHaveBeenCalledOnce();
    const token = hudTest.voice.mock.calls[0][4].earlyWorkOrder;
    setSurveyTargetPresentation({ ...run.snapshot, frame: 2, fit: 'offscreen', horizontalOffscreen: true, direction: 'D' }, true); run.next();
    expect(run.line.textContent).toBe('WALK [▶] TO BIOFIBER.');
    expect(hudTest.retire).toHaveBeenCalledWith(token);
    setSurveyTargetPresentation({ ...run.snapshot, frame: 3 }, true); run.next();
    expect(run.line.textContent).toBe('HOLD [EXTRACT] TO HARVEST BIOFIBER.');
    expect(hudTest.voice).toHaveBeenCalledOnce();
    if (run.cleanup) run.cleanup();
  });
  it.each(['offscreen', 'unresolved'] as const)('consumes %s first presentation and never voices the later canonical reveal', mode => {
    const run = mountEarlyOrder(mode); run.next();
    expect(hudTest.consume).toHaveBeenCalledOnce(); expect(hudTest.voice).not.toHaveBeenCalled();
    setSurveyTargetPresentation({ ...run.snapshot, fit: 'visible', horizontalOffscreen: false, direction: null, frame: 2 }, true); run.next();
    expect(run.line.textContent).toBe('HOLD [EXTRACT] TO HARVEST BIOFIBER.'); expect(hudTest.voice).not.toHaveBeenCalled();
  });
  it('keeps an already native-actionable extraction canonical even without bracket label fit', () => {
    const run = mountEarlyOrder('unresolved', true); run.next();
    expect(run.line.textContent).toBe('HOLD [EXTRACT] TO HARVEST BIOFIBER.'); expect(hudTest.voice).toHaveBeenCalledOnce();
  });
  it('requires the whole final line and clears the measured story debug trigger rectangle', () => {
    const run = mountEarlyOrder('visible');
    hudTest.reservations = [{ id: 'story-debug-trigger', left: 332, top: 66, right: 376, bottom: 110, width: 44, height: 44 }];
    run.line.scrollWidth = 500; run.next();
    expect(Number.parseFloat(run.order.style.top)).toBeGreaterThanOrEqual(124);
    expect(run.order.dataset.orderWholeLineVisible).toBe('false');
    expect(hudTest.voice).not.toHaveBeenCalled(); expect(hudTest.consume).toHaveBeenCalledOnce();
    run.line.scrollWidth = 250; run.next(); expect(hudTest.voice).not.toHaveBeenCalled();
  });
  it('does not use a stale objective or restore snapshot to fabricate a bearing', () => {
    const run = mountEarlyOrder('visible'); run.next();
    setSurveyTargetPresentation({ ...run.snapshot, restoreVersion: run.snapshot.restoreVersion + 1, fit: 'offscreen', horizontalOffscreen: true, direction: 'A' }, true); run.next();
    expect(run.line.textContent).toBe('HOLD [EXTRACT] TO HARVEST BIOFIBER.');
    expect(run.order.dataset.targetFit).toBe('unresolved');
    expect(hudTest.retire).toHaveBeenCalled();
  });
  it('uses the immediately preceding finalized frame while the next projection is pending, without falsely retiring visible voice', () => {
    const run = mountEarlyOrder('visible'); run.next();
    hudTest.retire.mockClear();
    setSurveyTargetPresentation({ ...run.snapshot, frame: 2, fit: 'pending', rect: undefined }); run.next();
    expect(hudTest.retire).not.toHaveBeenCalled();
    setSurveyTargetPresentation({ ...run.snapshot, frame: 2, fit: 'unresolved', rect: undefined }, true); run.next();
    expect(hudTest.retire).toHaveBeenCalled();
    expect(hudTest.voice).toHaveBeenCalledOnce();
  });
  it('invalidates a prior viewport fit silently during resize without replay on return', () => {
    const run = mountEarlyOrder('visible'); run.next();
    vi.stubGlobal('window', { innerWidth: 844, innerHeight: 390 }); run.next();
    expect(run.order.dataset.targetFit).toBe('unresolved');
    expect(hudTest.retire).toHaveBeenCalled();
    vi.stubGlobal('window', { innerWidth: 390, innerHeight: 844 }); run.next();
    expect(hudTest.voice).toHaveBeenCalledOnce();
  });
  it('uses exactly the existing desktop and touch glyphs without changing the canonical objective', () => {
    const run = mountEarlyOrder('offscreen');
    expect(presentInputGlyphs(run.line.textContent, true, 'feed')).toBe('WALK [▶] TO BIOFIBER.');
    expect(presentRegulationObjective(run.snapshot.objective)).toEqual(['HOLD [E] TO HARVEST BIOFIBER.']);
  });
});
