import { useEffect, useState, useSyncExternalStore } from 'react';
import { getGameCanvas } from '../../state/appState.ts';
import { isTouchDevice, releaseAllKeys } from '../../utils/mobileInput.ts';
import { subscribeProgression, getMilestones } from '../../game/systems/progressionSystem.ts';
import { MAP_QUESTIONS, type MapQuestion } from '../../story/unfinishedMapState.ts';
import { closeUnfinishedMap, expandMapEntry, getUnfinishedMapSnapshot, indexMapSurvey, openUnfinishedMap,
  retainMapQuestion, selectMapReturn, subscribeUnfinishedMap, unfinishedMapVersion } from '../../story/unfinishedMapDirector.ts';
import './unfinishedMap.css';

export default function UnfinishedMapPanel({ visible }: { visible: boolean }) {
  useSyncExternalStore(subscribeUnfinishedMap, unfinishedMapVersion);
  useSyncExternalStore(subscribeProgression, () => getMilestones().length);
  const record = getUnfinishedMapSnapshot();
  const [choice, setChoice] = useState<MapQuestion>('survived');
  useEffect(() => {
    if (record.panelOpen) {
      releaseAllKeys();
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }, [record.panelOpen]);
  const close = () => {
    closeUnfinishedMap(); releaseAllKeys();
    if (!isTouchDevice()) {
      try { const result = getGameCanvas()?.requestPointerLock(); result?.catch?.(() => {}); } catch { /* Visible canvas remains the recovery target. */ }
    }
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!visible || event.repeat || event.target instanceof HTMLInputElement) return;
      if (event.code === 'Escape' && record.panelOpen) { event.preventDefault(); close(); }
      if (event.code === 'KeyN' && record.opened) {
        event.preventDefault(); if (record.panelOpen) close(); else openUnfinishedMap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, record.panelOpen, record.opened]);
  if (!visible || !record.opened) return null;
  if (!record.panelOpen) return <button className="um-trigger" data-ch14="open" onClick={openUnfinishedMap}>field record <span>[N]</span></button>;
  return <aside className="um-record" aria-label="The Unfinished Map" data-ch14="record">
    <header><div><small>TERRA · FIELD RECORD / 01</small><h2>the unfinished map</h2></div>
      <button data-ch14="close" onClick={close} aria-label="Close field record">close ×</button></header>
    <p className="um-limit">two places. separate observations. no final account.</p>
    {record.retained && record.question && <p className="um-heading" data-ch14="heading">{MAP_QUESTIONS[record.question]}</p>}
    {(['survey', 'scar'] as const).map(place => {
      if (place === 'scar' && !record.scar) return null;
      const selected = record.expanded === place;
      return <section key={place} className="um-entry">
        <button className="um-entry-title" data-ch14={`entry-${place}`} aria-expanded={selected} onClick={() => expandMapEntry(place)}>
          <span>{place === 'survey' ? '01 / retained common passage' : '02 / repaired hull'}</span><span>{selected ? '−' : '+'}</span>
        </button>
        {selected && <div className="um-entry-body">
          {place === 'survey' ? <>
            <small>TERRA · OBSERVED AT ORIGIN</small>
            <p>i crossed the passage using the end he held. then i held the separate reference while he completed his own test.</p>
            <p>retained route: {record.survey.routeClass ?? 'local survey'}{record.survey.lengthUnits !== null ? ` · ${Math.round(record.survey.lengthUnits)}m recorded` : ''}. this account belongs to this ground.</p>
            <small>W-7744 · ATTRIBUTED LOCAL RESULT</small>
            <p className="um-worker">LOCAL RECORD: PASSAGE OBSERVED. MODEL INCOMPLETE.</p>
            {record.returned && <p data-ch14="return-receipt">return visit recorded. the question remains open.</p>}
          </> : <>
            <small>TERRA · PRESENT OBSERVATION AT ORIGIN</small>
            <p>the repair works. the scar remains.</p>
            <p>this visit records what is here now. it does not fill in a repair stage i did not observe.</p>
          </>}
          {record.retained && (place === 'survey' || record.complete) && <button data-ch14={`return-${place}`} onClick={() => selectMapReturn(place)}>Return to this place</button>}
        </div>}
      </section>;
    })}
    {!record.indexed && <button data-ch14="visit-hull" onClick={() => { if (indexMapSurvey()) close(); }}>Visit the repaired hull</button>}
    {record.scar && !record.retained && <fieldset><legend>which question heads this record?</legend>
      {(['survived', 'changed'] as const).map(q => <label key={q}><input type="radio" name="map-question" data-ch14={`question-${q}`} checked={choice === q} onChange={() => setChoice(q)} />{MAP_QUESTIONS[q]}</label>)}
      <button data-ch14="retain" onClick={() => retainMapQuestion(choice)}>Retain both entries</button>
    </fieldset>}
    <p className="um-feedback" role="status">{record.feedback || (record.selected ? 'destination: retained common passage. close the record and walk back.' : 'the record keeps its limits.')}</p>
    <footer>close to walk and look · entries are saved with your journey</footer>
  </aside>;
}
