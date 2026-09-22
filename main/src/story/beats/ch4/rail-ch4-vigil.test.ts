import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import type {RailRuntime} from '../../autopilot.ts';
import {tick as vigil} from './rail-ch4-vigil.ts';
import {tick as firstRest} from '../ch3/rail-ch3-await-rest.ts';

function context(distance=2.2,ready=true){
  return {
    getPlayerWorldPosition:()=>new THREE.Vector3(0,52.79,0),
    getPlayerUp:()=>new THREE.Vector3(0,1,0),
    getCampfires:()=>[{pos:[2.2,51,0]}],_target:new THREE.Vector3(),_goalScratch:new THREE.Vector3(),
    beatClock:90,controls:{forward:true,backward:false,left:false,right:false},
    walkToward:vi.fn(()=>distance),pulseInteract:vi.fn(),vigilRestReady:()=>ready,
    setCinematicLookWeight:vi.fn(),setCinematicLookTarget:vi.fn(),setCinematicGazeIntent:vi.fn(),
    vigilSkyLookTarget:vi.fn(()=>new THREE.Vector3(0,70,0))
  };
}
describe('campfire rail arrival uses the walking helper distance',()=>{
  it.each([['first rest',firstRest],['vigil',vigil]] as const)('%s rests when the walker arrived despite capsule height',(_,tick)=>{
    const c=context();expect(c.getPlayerWorldPosition().distanceTo(new THREE.Vector3(2.2,51,0))).toBeGreaterThan(2.4);
    tick(c as unknown as RailRuntime);expect(c.walkToward).toHaveBeenCalledOnce();expect(c.pulseInteract).toHaveBeenCalledOnce();expect(c.setCinematicLookWeight).toHaveBeenLastCalledWith(0);
  });
  it.each([['first rest',firstRest],['vigil',vigil]] as const)('%s continues approaching until the walker arrives',(_,tick)=>{
    const c=context(3);tick(c as unknown as RailRuntime);expect(c.walkToward).toHaveBeenCalledOnce();expect(c.pulseInteract).not.toHaveBeenCalled();
  });
  it('holds the sky reveal until the actual rest prompt is ready',()=>{
    const c=context(2.2,false);vigil(c as unknown as RailRuntime);expect(c.pulseInteract).not.toHaveBeenCalled();expect(c.vigilSkyLookTarget).toHaveBeenCalledOnce();expect(c.setCinematicLookWeight).toHaveBeenLastCalledWith(1);
  });
});
