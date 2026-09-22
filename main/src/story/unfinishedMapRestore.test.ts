import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clearAllCommonGroundWorlds, readCommonGroundLive, stageCommonGroundWorldPayload } from './commonGroundState.ts';
import { markMilestone, resetProgression } from '../game/systems/progressionSystem.ts';
import { getLocalActorId } from '../game/playerActors.ts';
import { enterPlaying, returnToMenu } from '../state/appState.ts';
import { resetSystemFlightForInterstellarArrival } from '../state/systemFlight.ts';
import { STORY_PRIMARY_WORLD_ID } from './tidegardenRoute.ts';
import { STORY_COORDINATE } from './world/storyWorldIdentity.ts';
import { tickUnfinishedMap, getUnfinishedMapSnapshot, setUnfinishedMapBlocked } from './unfinishedMapDirector.ts';
import { UM } from './unfinishedMapState.ts';

// Saved by an actual hardware Continue run after the ordinary reciprocal walk.
const earned = JSON.parse(readFileSync(new URL('./__fixtures__/chapter14-earned-common-ground.json', import.meta.url), 'utf8'));
beforeEach(() => {
 clearAllCommonGroundWorlds(); resetProgression();
 vi.stubGlobal('document', {hidden:false,hasFocus:()=>true});
 resetSystemFlightForInterstellarArrival({system:STORY_COORDINATE,activePlanetId:STORY_PRIMARY_WORLD_ID,locationMode:'surface',pose:{position:[0,0,0],velocity:[0,0,0],quaternion:[0,0,0,1]}});
 markMilestone(UM.opened);markMilestone(UM.indexed);enterPlaying();setUnfinishedMapBlocked(false);
});
afterEach(() => {clearAllCommonGroundWorlds();resetProgression();returnToMenu();vi.unstubAllGlobals();});
it('hydrates an earned prior-chapter record on the Chapter14 tick, including a late world restore', () => {
 expect(readCommonGroundLive(STORY_PRIMARY_WORLD_ID)).toBeNull();
 tickUnfinishedMap();
 stageCommonGroundWorldPayload(STORY_PRIMARY_WORLD_ID,{...earned,actorId:getLocalActorId()});
 tickUnfinishedMap();
 const restored=readCommonGroundLive(STORY_PRIMARY_WORLD_ID)!;
 expect(restored.hydrated).toBe(true);
 expect(restored.common).toMatchObject({committed:true,comparisonProved:true,finalReferenceOccupied:false});
 expect(restored.survey.accepted).toMatchObject(earned.survey.accepted);
 expect(getUnfinishedMapSnapshot().anchors).toEqual([]);
});
it.each(['actor','world'])('rejects a saved proof from a different %s', identity => {
 const bad={...earned,actorId:identity==='actor'?'foreign':getLocalActorId(),worldId:identity==='world'?'-1,-1:p1':STORY_PRIMARY_WORLD_ID};
 stageCommonGroundWorldPayload(STORY_PRIMARY_WORLD_ID,bad);tickUnfinishedMap();
 expect(readCommonGroundLive(STORY_PRIMARY_WORLD_ID)?.common.committed).toBe(false);
 expect(getUnfinishedMapSnapshot().ready).toBe(false);
});
