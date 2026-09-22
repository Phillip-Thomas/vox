import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {runCase} from './capture-case.mjs';
import {validateAction,validateControlConfig,walkByInputs,walkViewDirections,faceWalkTarget} from './control-capture.mjs';
const base={chapter:'ch99',beats:['ch99-a'],acceptedMilestones:['earned'],steps:[{type:'press',code:'KeyF'}]};
test('ordinary camera turns toward travel using bounded mouse input and yields to authored shots',async()=>{
 let clock=0,yaw=0,ordinaryLook=true,moves=[];
 const action={type:'walk',posePointer:'/p',target:[5,0,0],timeoutMs:10000,arriveWithin:.2};
 const io={now:()=>clock,wait:async ms=>{clock+=ms;},read:async()=>({p:[0,0,0],view:{ordinaryLook,pointerLocked:true,up:[0,1,0],forward:[Math.sin(yaw),0,-Math.cos(yaw)]}}),move:async dx=>{moves.push(dx);yaw+=dx*.002;}};
 const result=await faceWalkTarget(action,io);assert.ok(result.turns>1);assert.ok(Math.abs(yaw-Math.PI/2)<.035);assert.ok(moves.every(dx=>Math.abs(dx)<=32));
 ordinaryLook=false;moves=[];assert.equal((await faceWalkTarget(action,io)).owned,false);assert.deepEqual(moves,[]);
 ordinaryLook=true;yaw=Math.PI/2;moves=[];await faceWalkTarget(action,io);assert.deepEqual(moves,[]);
});
test('free-look walking uses the observed heading without four-direction calibration',async()=>{
 let clock=0,p=[0,0,0],held=[],measurements=0;
 const view={ordinaryLook:true,pointerLocked:true,forward:[1,0,0],up:[0,1,0]};
 const a={type:'walk',posePointer:'/p',target:[5,0,0],timeoutMs:5000,arriveWithin:.2};
 const keys=[];const advance=ms=>{clock+=ms;for(const k of held)if(k==='KeyW')p=[p[0]+ms*.005,0,0];};
 const result=await walkByInputs(a,{chords:true,now:()=>clock,read:async()=>({p,view}),wait:async ms=>advance(ms),hold:async(k,ms)=>{held=Array.isArray(k)?k:[k];keys.push(...held);advance(ms);},release:async()=>{held=[];},calibrated:async()=>{measurements++;}});
 assert.equal(result.arrived,true);assert.equal(measurements,0);assert.deepEqual([...new Set(keys)],['KeyW']);
 assert.equal(walkViewDirections({...view,ordinaryLook:false},a),null);
});
test('invalid controls fail before build, preview or candidate output',async t=>{
 const repo=fs.mkdtempSync(path.join(os.tmpdir(),'case-early-'));t.after(()=>fs.rmSync(repo,{recursive:true,force:true}));
 fs.writeFileSync(path.join(repo,'config.json'),JSON.stringify({chapter:'ch99',manual:{...base,steps:[{type:'wait',pointer:'/story',equals:true,timeoutMs:60000}]}}));
 const out=path.join(repo,'out');await assert.rejects(runCase({repo,chapter:'ch99',kind:'manual',out,config:'config.json',build:true}),/Invalid manual config.*\n.*30000/);assert.equal(fs.existsSync(out),false);
});
test('bootstrap validates the same ordinary actions and rejects misspelled fields',()=>{
 assert.equal(validateControlConfig({...base,bootstrapSteps:[{type:'click',selector:'button'}]},'manual').bootstrapSteps.length,1);
 assert.equal(validateControlConfig({...base,bootstrapSteps:[{type:'waitSelector',selector:'button',state:'visible',timeoutMs:1000}]},'manual').bootstrapSteps.length,1);
 assert.throws(()=>validateControlConfig({...base,bootstrapSteps:[{type:'eval'}]},'manual'),/unsupported/);
 assert.throws(()=>validateAction({type:'key',code:'KeyW',durationMs:600},'test'),/unknown key field/);
 assert.throws(()=>validateAction({type:'walk',target:[1,2,3],timeoutMs:30001,posePointer:'/p'},'test'),/30000/);
 assert.throws(()=>validateAction({type:'walk',target:[1,2,3],timeoutMs:30000},'test'),/posePointer/);
});
test('walk uses measured key displacement on a tilted ground plane and stops when motion stalls',async()=>{
 let clock=0,p=[0,0,0];const dirs={KeyW:[0,.02,.02],KeyS:[0,-.02,-.02],KeyA:[-.02,0,0],KeyD:[.02,0,0]};
 const action={type:'walk',posePointer:'/p',target:[3,3,3],timeoutMs:5000,arriveWithin:.3,noProgressMs:1500};
 const result=await walkByInputs(action,{read:async()=>({p}),now:()=>clock,wait:async ms=>{clock+=ms;},hold:async(k,ms)=>{clock+=ms+80;p=p.map((v,i)=>v+dirs[k][i]*ms);}});
 assert.equal(result.arrived,true);assert.ok(Math.hypot(...p.map((v,i)=>v-action.target[i]))<=.3);
 clock=0;await assert.rejects(walkByInputs(action,{read:async()=>({p:[0,0,0]}),now:()=>clock,hold:async(k,ms)=>{clock+=ms;}}),/no measured displacement/);
});

test('walk waits for a stable observed arrival instead of yielding the next input during descent',async()=>{
 let clock=0,keys=0;
 const action={type:'walk',posePointer:'/p',target:[0,0,0],timeoutMs:3000,arriveWithin:.55,noProgressMs:1500};
 const result=await walkByInputs(action,{now:()=>clock,wait:async ms=>{clock+=ms;},
  read:async()=>({p:[0,Math.max(0,.4-clock/1000),0]}),hold:async()=>{keys++;}});
 assert.equal(result.arrived,true);assert.equal(result.settled,true);assert.equal(keys,0);assert.ok(clock>=700);
 assert.equal(result.distance,0);
});

test('walk reuses measured controls across waypoints and relearns a changed world basis',async()=>{
 let clock=0,p=[0,0,0],beat='first';const memory={},dirs={KeyW:[0,0,.01],KeyS:[0,0,-.01],KeyA:[-.01,0,0],KeyD:[.01,0,0]};
 const io={memory,now:()=>clock,wait:async ms=>{clock+=ms;},read:async()=>({p,story:{beat}}),hold:async(k,ms)=>{clock+=ms;p=p.map((v,i)=>v+dirs[k][i]*ms);}};
 const action={type:'walk',posePointer:'/p',target:[3,0,0],timeoutMs:5000,arriveWithin:.3,noProgressMs:1500};
 assert.equal((await walkByInputs(action,io)).calibrations,1);
 assert.equal((await walkByInputs({...action,target:[6,0,0]},io)).calibrations,0);
 beat='second';assert.equal((await walkByInputs({...action,target:[9,0,0]},io)).calibrations,1);
});
test('walk invalidates cached controls when observed motion disagrees even without a new world id',async()=>{
 let clock=0,p=[0,0,0],flip=1;const memory={},dirs={KeyW:[0,0,.01],KeyS:[0,0,-.01],KeyA:[-.01,0,0],KeyD:[.01,0,0]};
 const io={memory,now:()=>clock,wait:async ms=>{clock+=ms;},read:async()=>({p}),hold:async(k,ms)=>{clock+=ms;p=p.map((v,i)=>v+dirs[k][i]*ms*flip);}};
 const action={type:'walk',posePointer:'/p',target:[3,0,0],timeoutMs:5000,arriveWithin:.3,noProgressMs:2500};
 await walkByInputs(action,io);flip=-1;
 const result=await walkByInputs({...action,target:[6,0,0]},io);assert.equal(result.arrived,true);assert.equal(result.calibrations,1);
});
test('continuous movement keeps a useful key down and releases it on failure',async()=>{
 const {heldWalkInput}=await import('./control-capture.mjs');const events=[];
 const input=heldWalkInput({down:async k=>events.push(['down',k]),up:async k=>events.push(['up',k])},async()=>{});
 await input.hold('KeyW',100);await input.hold('KeyW',100);await input.hold('KeyA',100);await input.release();
 assert.deepEqual(events,[['down','KeyW'],['up','KeyW'],['down','KeyA'],['up','KeyA']]);
 let clock=0,releases=0;
 await assert.rejects(walkByInputs({type:'walk',posePointer:'/p',target:[9,0,0],timeoutMs:5000},
  {now:()=>clock,wait:async ms=>{clock+=ms;},read:async()=>({p:[0,0,0]}),hold:async()=>{throw Error('lost browser');},release:async()=>{releases++;}}),/lost browser/);
 assert.ok(releases>=2);
});


test('grounded steering ignores gravity displacement while keeping full three-dimensional arrival distance',async()=>{
 let clock=0,p=[0,3,0];const dirs={KeyW:[0,0,.01],KeyS:[0,0,-.01],KeyA:[-.01,0,0],KeyD:[.01,0,0]};
 const advance=ms=>{clock+=ms;p[1]=Math.max(0,p[1]-ms*.002);};
 const result=await walkByInputs({type:'walk',posePointer:'/p',target:[4,0,2],timeoutMs:6000,arriveWithin:.3,noProgressMs:2000},
  {now:()=>clock,wait:async ms=>advance(ms),read:async()=>({p,commonGround:{up:[0,1,0]}}),
   hold:async(k,ms)=>{advance(ms);p=p.map((v,i)=>v+dirs[k][i]*ms);}});
 assert.equal(result.arrived,true);assert.equal(result.calibrations,1);assert.ok(Math.hypot(p[0]-4,p[1],p[2]-2)<=.3);
});


test('walk brakes before slow browser observations at tight waypoints',async()=>{
 let clock=0,p=[0,0,0],held=null;const dirs={KeyW:[0,0,-.005],KeyS:[0,0,.005],KeyA:[-.005,0,0],KeyD:[.005,0,0]};
 const advance=ms=>{clock+=ms;if(held)p=p.map((v,i)=>v+dirs[held][i]*ms);};
 const result=await walkByInputs({type:'walk',posePointer:'/p',target:[3,.06,2],timeoutMs:8000,arriveWithin:.16,noProgressMs:2000,tickMs:100},
  {now:()=>clock,wait:async ms=>advance(ms),read:async()=>{advance(30);return {p,commonGround:{up:[0,1,0]}};},
   hold:async(k,ms)=>{held=k;advance(ms);},release:async()=>{held=null;},tick:async()=>advance(80)});
 assert.equal(result.arrived,true);assert.equal(held,null);assert.ok(result.distance<=.16);
});

test('diagonal steering follows a narrow declared segment despite rotated controls and browser latency',async()=>{
 let clock=0,p=[0,0,0],held=[],chords=0,maxCross=0;const theta=Math.PI/9,c=Math.cos(theta),s=Math.sin(theta);
 const dirs={KeyD:[c,0,-s],KeyA:[-c,0,s],KeyS:[s,0,c],KeyW:[-s,0,-c]};
 const advance=ms=>{clock+=ms;if(held.length){const scale=.005*ms/Math.sqrt(held.length);p=p.map((v,i)=>v+held.reduce((sum,k)=>sum+dirs[k][i],0)*scale);}maxCross=Math.max(maxCross,Math.abs(p[2]));assert.ok(maxCross<.45,`left narrow route at ${maxCross}`);};
 const result=await walkByInputs({type:'walk',posePointer:'/p',target:[8,.06,0],timeoutMs:10000,arriveWithin:.16,noProgressMs:2500,tickMs:100},
  {chords:true,now:()=>clock,wait:async ms=>advance(ms),read:async()=>{advance(30);return {p,commonGround:{up:[0,1,0]}};},hold:async(k,ms)=>{held=Array.isArray(k)?k:[k];if(held.length>1)chords++;advance(ms);},release:async()=>{held=[];},tick:async()=>advance(80)});
 assert.equal(result.arrived,true);assert.ok(chords>0);assert.ok(result.distance<=.16);
});
test('diagonal input retains shared keys while switching and releases the complete chord',async()=>{
 const {heldWalkInput}=await import('./control-capture.mjs'),events=[];
 const io=heldWalkInput({down:async k=>events.push(['down',k]),up:async k=>events.push(['up',k])},async()=>{});
 await io.hold(['KeyW','KeyD'],100);await io.hold(['KeyW','KeyA'],100);await io.release();
 assert.deepEqual(events,[['down','KeyW'],['down','KeyD'],['up','KeyD'],['down','KeyA'],['up','KeyW'],['up','KeyA']]);
});
