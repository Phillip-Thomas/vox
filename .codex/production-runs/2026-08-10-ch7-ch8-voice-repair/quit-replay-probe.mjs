import os from 'node:os'; import path from 'node:path'; import fs from 'node:fs';
const { chromium } = await import('/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs');
const B='http://localhost:5176'; const pw=path.join(os.homedir(),'.cache/ms-playwright');
const cd=fs.readdirSync(pw).filter(d=>/^chromium-\d+$/.test(d)).sort().pop();
const br=await chromium.launch({executablePath:path.join(pw,cd,'chrome-linux/chrome'),headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--window-size=1280,720']});
const L4='i came down this line without being asked. i am going back up it on purpose.';
const INSTALL=async()=>{const st=await import('/src/story/storyText.ts');const c=await import('/src/story/storyClock.ts');const o=await import('/src/story/ux/objectiveDirector.ts');
 window.__clk=c.storyNow;window.__txt=()=>JSON.parse(JSON.stringify(st.getStoryText()));
 window.__obj=()=>{const x=o.getActiveGuidedStoryObjective();return x?{id:x.id,markerLabel:x.markerLabel,health:o.getGuidedStoryObjectiveHealth()}:null;};
 window.__ev=[];let lc='',la='';st.subscribeStoryText(()=>{const s=st.getStoryText();
  const k=s.caption?s.caption.text+'@'+s.caption.shownAt:'n';if(k!==lc){lc=k;window.__ev.push({t:c.storyNow(),ch:'caption',text:s.caption?.text??null});}
  const a=s.audit?s.audit.text+'@'+s.audit.shownAt:'n';if(a!==la){la=a;window.__ev.push({t:c.storyNow(),ch:'audit',text:s.audit?.text??null});}});};
const out={capturedAt:new Date().toISOString(),cases:[]};
const waitForL4=async(page)=>{const dl=Date.now()+150000;while(Date.now()<dl){const h=await page.evaluate(n=>window.__ev.some(e=>e.text===n),L4);if(h)return true;await new Promise(r=>setTimeout(r,50));}return false;};
// quit-to-sandbox mid-window
{ const p=await br.newPage({viewport:{width:1280,height:720}});
  await p.goto(`${B}/?story=ch8-launch&movie=1&profile=LOW`,{waitUntil:'load',timeout:90000});
  await p.evaluate(INSTALL); const got=await waitForL4(p);
  await new Promise(r=>setTimeout(r,4000));
  const mid={beat:await p.evaluate(()=>window.__storyBeat??null),text:await p.evaluate(()=>window.__txt()),obj:await p.evaluate(()=>window.__obj())};
  await p.goto(`${B}/`,{waitUntil:'load',timeout:90000});
  await p.evaluate(INSTALL); await new Promise(r=>setTimeout(r,20000));
  const after={beat:await p.evaluate(()=>window.__storyBeat??null),text:await p.evaluate(()=>window.__txt()),obj:await p.evaluate(()=>window.__obj()),events:await p.evaluate(()=>window.__ev)};
  out.cases.push({case:'quit',reachedWindow:got,mid,after}); console.log('quit: mid beat',mid.beat,'-> after beat',after.beat,'audit',after.text.audit,'caption',after.text.caption,'obj',after.obj,'events',after.events.length);
  await p.close(); }
// replay: reload the same deep link mid-window
{ const p=await br.newPage({viewport:{width:1280,height:720}});
  await p.goto(`${B}/?story=ch8-launch&movie=1&profile=LOW`,{waitUntil:'load',timeout:90000});
  await p.evaluate(INSTALL); const got=await waitForL4(p);
  await new Promise(r=>setTimeout(r,6000));
  const mid={beat:await p.evaluate(()=>window.__storyBeat??null),text:await p.evaluate(()=>window.__txt())};
  await p.reload({waitUntil:'load',timeout:90000});
  await p.evaluate(INSTALL); await new Promise(r=>setTimeout(r,6000));
  const after={beat:await p.evaluate(()=>window.__storyBeat??null),text:await p.evaluate(()=>window.__txt()),obj:await p.evaluate(()=>window.__obj()),events:await p.evaluate(()=>window.__ev)};
  out.cases.push({case:'replay',reachedWindow:got,mid,after}); console.log('replay: after beat',after.beat,'events',JSON.stringify(after.events.map(e=>[e.ch,(e.text||'').slice(0,40)])));
  await p.close(); }
fs.writeFileSync('quit-replay.json',JSON.stringify(out,null,2));
await br.close();
