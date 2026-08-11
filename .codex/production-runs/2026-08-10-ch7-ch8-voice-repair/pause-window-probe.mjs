import os from 'node:os'; import path from 'node:path'; import fs from 'node:fs';
const { chromium } = await import('/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs');
const BASE='http://localhost:5176';
const pwDir=path.join(os.homedir(),'.cache/ms-playwright');
const chromeDir=fs.readdirSync(pwDir).filter(d=>/^chromium-\d+$/.test(d)).sort().pop();
const browser=await chromium.launch({executablePath:path.join(pwDir,chromeDir,'chrome-linux/chrome'),headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--window-size=1280,720']});
const L4='i came down this line without being asked. i am going back up it on purpose.';
const out={capturedAt:new Date().toISOString(),cases:[]};
for (const holdSeconds of [5]) {
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.goto(`${BASE}/?story=ch8-launch&movie=1&profile=LOW`,{waitUntil:'load',timeout:90000});
  await page.evaluate(async ()=>{
    const st=await import('/src/story/storyText.ts');
    const clock=await import('/src/story/storyClock.ts');
    const app=await import('/src/state/appState.ts');
    window.__clk=clock.storyNow; window.__paused=()=>clock.isStoryPaused();
    window.__phase=()=>app.getAppStateSnapshot().phase;
    window.__ev=[]; let lc='',la='';
    st.subscribeStoryText(()=>{const s=st.getStoryText();
      const c=s.caption?s.caption.text+'@'+s.caption.shownAt:'n'; if(c!==lc){lc=c;window.__ev.push({t:clock.storyNow(),raw:performance.now(),ch:'caption',text:s.caption?.text??null});}
      const a=s.audit?s.audit.text+'@'+s.audit.shownAt:'n'; if(a!==la){la=a;window.__ev.push({t:clock.storyNow(),raw:performance.now(),ch:'audit',text:s.audit?.text??null});}});
    const ss=await import('/src/story/storyState.ts'); let lb='';
    ss.subscribeStory(()=>{const b=ss.getStoryStateSnapshot().beat; if(b!==lb){lb=b;window.__ev.push({t:clock.storyNow(),raw:performance.now(),ch:'beat',text:b});}});
  });
  const dl=Date.now()+180000; let origin=null;
  while(Date.now()<dl){const o=await page.evaluate(n=>(window.__ev.find(e=>e.text===n)||{}).t??null,L4); if(o!==null){origin=o;break;} await new Promise(r=>setTimeout(r,30));}
  while(Date.now()<dl){const now=await page.evaluate(()=>window.__clk()); if(now-origin>=3000)break; await new Promise(r=>setTimeout(r,20));}
  const before=await page.evaluate(()=>({clk:window.__clk(),raw:performance.now(),paused:window.__paused(),phase:window.__phase()}));
  await page.evaluate(()=>{document.dispatchEvent(new Event('pointerlockchange'));});
  await new Promise(r=>setTimeout(r,200));
  const during=await page.evaluate(()=>({clk:window.__clk(),raw:performance.now(),paused:window.__paused()}));
  await new Promise(r=>setTimeout(r,holdSeconds*1000));
  const afterHold=await page.evaluate(()=>({clk:window.__clk(),raw:performance.now(),paused:window.__paused()}));
  await page.evaluate(()=>{Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>document.body});document.dispatchEvent(new Event('pointerlockchange'));});
  await new Promise(r=>setTimeout(r,200));
  const resumed=await page.evaluate(()=>({clk:window.__clk(),raw:performance.now(),paused:window.__paused()}));
  const sd=Date.now()+120000;
  while(Date.now()<sd){const b=await page.evaluate(()=>window.__storyBeat??null); if(b==='ch8-crossing')break; await new Promise(r=>setTimeout(r,200));}
  await new Promise(r=>setTimeout(r,1500));
  const ev=await page.evaluate(()=>window.__ev);
  out.cases.push({holdSeconds,origin,before,during,afterHold,resumed,
    offsets:ev.filter(e=>e.t>=origin-50).map(e=>({ch:e.ch,text:e.text,storyOffset:Number(((e.t-origin)/1000).toFixed(3)),wallOffset:Number(((e.raw-origin)/1000).toFixed(3))}))});
  console.log('paused engaged:',during.paused,'clk frozen delta over hold:',(afterHold.clk-during.clk).toFixed(1),'ms; raw delta:',(afterHold.raw-during.raw).toFixed(1),'ms');
  for(const o of out.cases[0].offsets) console.log(' ',o.storyOffset,o.wallOffset,o.ch,(o.text||'').slice(0,45));
  await page.close();
}
fs.writeFileSync('pause-probe.json',JSON.stringify(out,null,2));
await browser.close();
