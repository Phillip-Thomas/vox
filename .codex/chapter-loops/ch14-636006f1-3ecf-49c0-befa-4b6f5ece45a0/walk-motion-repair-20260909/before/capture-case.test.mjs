import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {runCase} from './capture-case.mjs';
import {validateAction,validateControlConfig,walkByInputs} from './control-capture.mjs';
const base={chapter:'ch99',beats:['ch99-a'],acceptedMilestones:['earned'],steps:[{type:'press',code:'KeyF'}]};
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
