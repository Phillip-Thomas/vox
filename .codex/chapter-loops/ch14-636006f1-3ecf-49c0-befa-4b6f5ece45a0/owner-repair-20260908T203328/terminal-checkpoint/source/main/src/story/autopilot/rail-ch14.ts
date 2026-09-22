import type { RailRuntime } from '../autopilot.ts';
import { canVisitMapPlace, getUnfinishedMapSnapshot, unfinishedMapTarget } from '../unfinishedMapDirector.ts';

/** The screening walks to the same targets, performs the registered F action,
 * and clicks the mounted record controls. It cannot grant a missing entry. */
export function tick(ctx: RailRuntime): void {
  ctx.clearControls();
  const record = getUnfinishedMapSnapshot();
  if (!record.ready || record.complete) return;
  const click = (name: string): void => {
    if (!ctx.screeningActionReady()) return;
    const button = document.querySelector<HTMLElement>(`[data-ch14="${name}"]`);
    if (!button || button.getClientRects().length === 0) return;
    button.click();
    ctx.noteScreeningAction();
  };
  if (record.panelOpen) {
    if (!record.indexed) click('visit-hull');
    else if (!record.scar) click('close');
    else if (!record.retained) click('retain');
    else if (!record.selected && record.expanded !== 'survey') click('entry-survey');
    else if (!record.selected) click('return-survey');
    else click('close');
    return;
  }
  if (record.scar && !record.selected) { click('open'); return; }
  const place = !record.opened || record.selected ? 'survey' : 'scar';
  const target = unfinishedMapTarget(place);
  if (!target) return;
  if (!canVisitMapPlace(place)) { ctx.walkToward(target, place === 'survey' ? 0.7 : 2); return; }
  ctx.performStoryInteraction(!record.opened ? 'story-ch14-record'
    : place === 'scar' ? 'story-ch14-scar' : 'story-ch14-return');
}
