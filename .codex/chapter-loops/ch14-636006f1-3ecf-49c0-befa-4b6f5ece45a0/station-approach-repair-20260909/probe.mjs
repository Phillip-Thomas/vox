import fs from 'node:fs';
import {chromium} from '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs';
import {assertHardwareGl} from '/home/thomasphillip/Projects/vox/main/tools/lib/previewServer.mjs';
import {faceWalkTarget,walkByInputs,heldWalkInput} from '/home/thomasphillip/Projects/vox/main/tools/chapter-loop/control-capture.mjs';
const dir='/home/thomasphillip/Projects/vox/.codex/chapter-loops/ch14-636006f1-3ecf-49c0-befa-4b6f5ece45a0/station-approach-repair-20260909';
const forward=true;
const out=dir+'/gpu-saved-forward';
fs.mkdirSync(out,{recursive:true});
const base=JSON.parse(fs.readFileSync(dir+'/preview-owner.json')).url;
const storageFile='/home/thomasphillip/Projects/vox/.codex/chapter-loops/ch14-636006f1-3ecf-49c0-befa-4b6f5ece45a0/foundation-repair-20260909/station-replay-storage.json';
const storage=JSON.parse(fs.readFileSync(storageFile));
const evidence={kind:'noncertifying replay of captured diagnostic save',storageFile,sourcePreview:base,steps:[],samples:[],errors:[]};
const browser=await chromium.launch({executablePath:'/snap/bin/chromium',headless:false,args:['--no-sandbox','--use-gl=angle','--use-angle=gl','--ignore-gpu-blocklist','--mute-audio','--disable-background-timer-throttling','--disable-renderer-backgrounding'],env:{...process.env,DISPLAY:':0'}});
let context;
const stop=()=>{evidence.interrupted=true;void browser.close();};
process.once('SIGTERM',stop);process.once('SIGINT',stop);
try {
 context=await browser.newContext({viewport:{width:1280,height:720},storageState:{cookies:[],origins:[{origin:new URL(base).origin,localStorage:Object.entries(storage).map(([name,value])=>({name,value}))}]}});
 const page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(String(e)));
 const read=()=>page.evaluate(()=>window.__paravoxiaJourneyProbe?.snapshot());
 const enter=async movie=>{
  await page.goto(base+'?journeyprobe=1&profile=HIGH'+(movie?'&movie=1':''));
  await page.getByRole('button',{name:/Continue/}).click({timeout:30000});
  await page.waitForFunction(()=>window.__paravoxiaJourneyProbe?.snapshot()?.shell.sceneReady,{},{timeout:30000});
 };
 await enter(forward);
 evidence.renderer=await assertHardwareGl(page,()=>{});
 if(!forward){
  await page.locator('canvas').first().click();await page.waitForTimeout(200);
  const action={type:'walk',posePointer:'/commonGround/bodyPose',target:[1.89,48.99,11.61],timeoutMs:30000,arriveWithin:.08,tickMs:50,minProgress:.01,noProgressMs:8000};
  let mx=640;const facing=await faceWalkTarget(action,{read,move:async dx=>{mx+=dx;await page.mouse.move(mx,360);},wait:ms=>page.waitForTimeout(ms)});
  const input=heldWalkInput(page.keyboard,ms=>page.waitForTimeout(ms));
  const walk=await walkByInputs(action,{read,...input,memory:{},chords:true});
  evidence.steps.push({facing,walk,after:await read()});
  if(!walk.arrived)throw new Error('Ordinary input approach did not arrive');
  await page.waitForTimeout(6000);
  evidence.positionedStorage=await page.evaluate(()=>({...localStorage}));
  await enter(true);
 }
 const start=Date.now();
 while(Date.now()-start<(forward?600000:90000)){
  const value=await page.evaluate(()=>({runtime:window.__paravoxiaJourneyProbe?.snapshot(),pilot:window.__autopilot,gaze:window.__cinematicGaze,contacts:window.__spaceStationContacts?.(),storage:{...localStorage}}));
  value.elapsedMs=Date.now()-start;evidence.samples.push(value);fs.appendFileSync(out+'/trace.ndjson',JSON.stringify(value)+'\n');
  if(evidence.samples.length%15===1)await page.screenshot({path:out+'/t'+Math.round(value.elapsedMs/1000)+'-'+value.runtime?.story?.beat+'.png'});
  if(forward?value.runtime?.unfinishedMap?.complete:value.runtime?.story?.beat==='ch9-hearth')break;
  await page.waitForTimeout(1000);
 }
 await page.screenshot({path:out+'/final.png'});
}catch(e){evidence.error=String(e);process.exitCode=2;}finally{
 if(context)await context.close().catch(()=>{});await browser.close();
 fs.writeFileSync(out+'/result.json',JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({kind:evidence.kind,samples:evidence.samples.length,error:evidence.error,lastBeat:evidence.samples.at(-1)?.runtime?.story?.beat}));
}
