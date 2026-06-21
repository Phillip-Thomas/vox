import { chromium } from 'playwright-core';
const EXE = 'C:/Users/Phillip/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
async function sample(world){
  const browser = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 500, height: 500 } });
  await page.goto(`http://localhost:5173/?world=${world}&bench=1`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(()=>{});
  await new Promise(r=>setTimeout(r, 8000));
  const r = await page.evaluate(() => {
    const h = window.__three; if(!h) return {err:'no __three'};
    const { gl, scene, camera } = h;
    let grass=null;
    scene.traverse(o=>{ if(o.isInstancedMesh){ const k=(()=>{try{return o.material.customProgramCacheKey();}catch{return '';}})()||''; if(/grass/.test(k)) grass=o; }});
    if(!grass||grass.count===0) return {err:'no grass'};
    const hidden=[]; scene.traverse(o=>{ if((o.isMesh||o.isInstancedMesh||o.isPoints)&&o!==grass&&o.visible){hidden.push(o);o.visible=false;} });
    const m=grass.instanceMatrix.array; const tx=m[12],ty=m[13],tz=m[14];
    const L=Math.hypot(tx,ty,tz)||1; const nx=tx/L,ny=ty/L,nz=tz/L;
    camera.position.set(tx+nx*2.4,ty+ny*2.4,tz+nz*2.4); camera.up.set(nx,ny,nz); camera.lookAt(tx,ty,tz);
    if('aspect'in camera){camera.aspect=1;camera.updateProjectionMatrix();} camera.updateMatrixWorld(true);
    scene.background=null; gl.setClearColor(0x000000,1);
    const W=500,Hh=500; for(let i=0;i<4;i++) gl.render(scene,camera);
    const ctx=gl.getContext(); const buf=new Uint8Array(W*Hh*4); ctx.readPixels(0,0,W,Hh,ctx.RGBA,ctx.UNSIGNED_BYTE,buf);
    let r=0,g=0,b=0,n=0; for(let i=0;i<buf.length;i+=4){const R=buf[i],G=buf[i+1],B=buf[i+2]; if(R+G+B>30){r+=R;g+=G;b+=B;n++;}}
    hidden.forEach(o=>o.visible=true);
    if(n===0) return {err:'no lit grass'};
    r/=n;g/=n;b/=n;
    const mx=Math.max(r,g,b); let dom = mx===r?'R':mx===g?'G':'B';
    return { hex:'#'+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''), dom };
  });
  await browser.close();
  return r;
}
const worlds=['0,0','21,4','-15,11','12,7','3,-9','7,7','-3,14','30,-5','42,18','-22,-22'];
for(const w of worlds){ console.log(w.padStart(7), JSON.stringify(await sample(w))); }
