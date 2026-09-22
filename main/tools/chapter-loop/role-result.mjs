import {requireThat} from './contract.mjs';

// The commission permits named events; the executable contract uses id arrays.
// Preserve every event verbatim alongside its ids. This changes representation,
// never the author's direction, verdict, anchors, findings or measured claims.
export function decodeRoleResult(stage,text) {
  const result=JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g,''));
  if(['plan','cinema','score-plan'].includes(stage)&&Array.isArray(result.anchors)
    &&result.anchors.length&&result.anchors.every(a=>a&&typeof a==='object'&&!Array.isArray(a))) {
    requireThat(result.anchors.every(a=>typeof a.id==='string'&&a.id.length>0&&typeof a.event==='string'
      &&a.event.length>0&&Object.keys(a).every(k=>['id','event'].includes(k))), 'Named event objects require exact id/event fields');
    requireThat(new Set(result.anchors.map(a=>a.id)).size===result.anchors.length,'Event ids must be unique');
    requireThat(!Object.hasOwn(result,'anchorEvents'),'Ambiguous duplicate event representation');
    result.anchorEvents=result.anchors;
    result.anchors=result.anchorEvents.map(a=>a.id);
  }
  return result;
}
