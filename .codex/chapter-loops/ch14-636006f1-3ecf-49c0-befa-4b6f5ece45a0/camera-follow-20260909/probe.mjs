import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs';
import {assertHardwareGl} from '/home/thomasphillip/Projects/vox/main/tools/lib/previewServer.mjs';
import {faceWalkTarget,walkByInputs,heldWalkInput} from '/home/thomasphillip/Projects/vox/main/tools/chapter-loop/control-capture.mjs';
const dir='/home/thomasphillip/Projects/vox/.codex/chapter-loops/ch14-636006f1-3ecf-49c0-befa-4b6f5ece45a0/camera-follow-20260909';
const owner=JSON.parse(fs.readFileSync(dir+'/preview-owner.json'));
const out=dir+'/gpu-smoke-fixed';fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({executablePath:'/snap/bin/chromium',headless:false,args:['--no-sandbox','--use-gl=angle','--use-angle=gl','--ignore-gpu-blocklist','--mute-audio'],env:{...process.env,DISPLAY:':0'}});
const evidence={url:owner.url,steps:[],trace:[],errors:[]};let ctx;
try {
 ctx=await b.newContext({viewport:{width:1280,height:720},recordVideo:{dir:out,size:{width:1280,height:720}}});const p=await ctx.newPage();p.on('pageerror',e=>evidence.errors.push(String(e)));
 await p.goto(owner.url+'?story=ch13-survey&journeyprobe=1&profile=HIGH');
 const read=()=>p.evaluate(()=>window.__paravoxiaJourneyProbe?.snapshot());
 await p.waitForFunction(()=>window.__paravoxiaJourneyProbe?.snapshot()?.shell.sceneReady&&window.__paravoxiaJourneyProbe?.snapshot()?.commonGround?.supported,{},{timeout:30000});
 await p.locator('canvas').first().click();await p.waitForTimeout(200);
 evidence.renderer=await assertHardwareGl(p,()=>{});let mx=640,my=360;const memory={};
 for(const target of [[-31.5,51.05,10],[-29,51.05,10]]){
  const action={type:'walk',posePointer:'/commonGround/bodyPose',target,timeoutMs:30000,arriveWithin:.3,tickMs:100,minProgress:.02,noProgressMs:8000};
  const before=await read();assert.equal(before.view.ordinaryLook,true);assert.equal(before.view.pointerLocked,true);
  const facing=await faceWalkTarget(action,{read,move:async dx=>{mx+=dx;await p.mouse.move(mx,my);},wait:async ms=>{await p.waitForTimeout(ms);evidence.trace.push({at:Date.now(),phase:'turn',view:(await read()).view});}});
  assert.equal(facing.aligned,true,'Camera actually converged on target');
  const input=heldWalkInput(p.keyboard,ms=>p.waitForTimeout(ms));
  const walk=await walkByInputs(action,{read,...input,memory,chords:true,tick:async()=>{const s=await read();evidence.trace.push({at:Date.now(),phase:'walk',view:s.view,pose:s.commonGround.bodyPose});}});
  assert.equal(walk.calibrations,0);assert.equal(walk.arrived,true);evidence.steps.push({target,before:before.view,facing,walk,after:(await read()).view});
  await p.screenshot({path:out+`/arrival-${evidence.steps.length}.png`});
 }
 assert.equal(evidence.errors.length,0);evidence.passed=true;
} catch(e){evidence.error=String(e);process.exitCode=1;} finally {if(ctx)await ctx.close();await b.close();fs.writeFileSync(out+'/result.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({...evidence,trace:evidence.trace.length}));}
