import { afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { tick } from './rail-ch1-fixed.ts';
import type { RailRuntime } from '../../autopilot.ts';
import { SIDE_RIG, setSideLens, clearSideLens, setLensRig, setSideCoverageViewport, sampleFixedScreenCoverage, getFixedScreenCoverage, applyActiveRigTransform, noteFixedScreenCoveragePresented } from '../../sideLens.ts';
vi.mock('../../debrisSalvage.ts', () => ({getDebrisPositions:()=>[],isDebrisCollected:()=>true}));
afterEach(clearSideLens);
function ready(along: number) {
 const lens={origin:new THREE.Vector3(),travelAxis:new THREE.Vector3(1,0,0),depthAxis:new THREE.Vector3(0,0,1),up:new THREE.Vector3(0,1,0)};
 setSideLens(lens);setLensRig({...SIDE_RIG,followQuant:1,travelBand:29});
 setSideCoverageViewport({width:1280,height:720,fov:75,aspect:1280/720,touch:false,safe:{left:0,right:0,top:0,bottom:0},reservations:[]});
 const player=new THREE.Vector3();sampleFixedScreenCoverage(player,1);sampleFixedScreenCoverage(player,2);
 player.x=along;sampleFixedScreenCoverage(player,3);
 const camera=new THREE.PerspectiveCamera(75,1280/720),parent=new THREE.Group();parent.position.copy(player);parent.add(camera);parent.updateMatrixWorld(true);applyActiveRigTransform(camera,lens,.016);noteFixedScreenCoveragePresented();sampleFixedScreenCoverage(player,4);
 const walk=vi.fn((_target:THREE.Vector3,_stop:number)=>0);
 const ctx={controls:{delete:false,left:false,right:false},getItemCount:()=>1,CH1_FIXED_TUTORIAL:{biofiber:1},getSideLens:()=>lens,getPlayerWorldPosition:()=>player,_goalScratch:new THREE.Vector3(),walkTowardTaskRow:walk} as unknown as RailRuntime;
 return {ctx,walk,player};
}
it.each([25,-25])('crosses a reachable camera edge after harvesting at %sm instead of marching into the travel wall', along => {
 const {ctx,walk}=ready(along),before=getFixedScreenCoverage()!;tick(ctx);
 expect(walk).toHaveBeenCalledOnce();const [goal,stop]=walk.mock.calls[0];
 expect(Math.abs(goal.x)).toBeLessThan(29);expect(Math.sign(goal.x-along)).toBe(-Math.sign(along));
 const edge=along>0?before.intervalMin:before.intervalMax;
 expect(Math.abs(goal.x-edge)).toBeGreaterThan(stop);
 const crossed=sampleFixedScreenCoverage(goal,5)!;
 expect(crossed.transfer?.reason).toBe('player-traversal');
});
it('waits for the actual destination paint instead of reversing through its boundary', () => {
 const {ctx,walk,player}=ready(0);player.x=getFixedScreenCoverage()!.intervalMax+.1;sampleFixedScreenCoverage(player,5);tick(ctx);
 expect(walk).not.toHaveBeenCalled();expect(ctx.controls.left||ctx.controls.right).toBe(false);
});
