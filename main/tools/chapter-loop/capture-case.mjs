import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureRuntime } from './runtime-capture.mjs';
import { captureControls, validateCaseFile } from './control-capture.mjs';
import { gameSnapshot, gameSourceSeal } from './cache.mjs';
import { inside, readJson, writeJson } from './store.mjs';
import { sha, requireThat } from './contract.mjs';
import { startPreview } from './evidence.mjs';
import { runProcess } from './process.mjs';

export function currentProvenance(repo, preview) {
  const hashes = Object.fromEntries(Object.entries(gameSnapshot(repo)).filter(([,v])=>v!==null)
    .map(([name])=>[name,sha(fs.readFileSync(inside(repo,name)))]));
  const sourceManifest = { schema:'paravoxia.captureSource.v1', hashes };
  return { sourceManifest, previewOwnership: { files:preview.manifest.files, url:preview.url,
    sourceManifestSha256:sha(sourceManifest), owner:'chapter-loop', daemonPid:preview.pid } };
}

export async function runCase({repo,chapter,kind,out,preview,config,build=false}) {
  requireThat(['manual','recovery','continue','continuity','av'].includes(kind),'Unsupported chapter case');
  const settings=readJson(inside(repo,config));
  requireThat(settings.chapter===chapter,'Control configuration chapter differs');
  requireThat(settings[kind]&&typeof settings[kind]==='object',`Missing real ${kind} configuration`);
  if (['manual','recovery','continue'].includes(kind)) validateCaseFile(settings,{chapter,kind});
  fs.mkdirSync(out,{recursive:true});
  const source=gameSourceSeal(repo);
  let owned,provenance;
  try {
    if(build) {
      const deadline=Date.parse(process.env.CHAPTER_LOOP_DEADLINE);
      requireThat(Number.isFinite(deadline)&&deadline>Date.now(),'Observation needs its original operation deadline');
      const result=await runProcess('npm',['run','build'],{cwd:inside(repo,'main'),log:path.join(out,'build.log'),
        timeoutMs:Math.min(300000,deadline-Date.now()),shouldStop:()=>Date.now()>=deadline?'deadline':false});
      requireThat(result.exitCode===0&&!result.reason,'Observation build failed');
      requireThat(gameSourceSeal(repo)===source,'Game changed during observation build');
      const dist=path.join(out,'dist');requireThat(!fs.existsSync(dist),'Observation archive must be fresh');
      fs.cpSync(inside(repo,'main/dist'),dist,{recursive:true});
      owned=await startPreview(dist,path.join(out,'preview.log')); preview=owned.url;
      provenance=currentProvenance(repo,owned);
    } else {
      const file=process.env.CHAPTER_LOOP_PROVENANCE;
      requireThat(file&&path.resolve(file).startsWith(path.resolve(repo)+path.sep),'Runner candidate provenance required');
      provenance=readJson(file);
    }
    writeJson(path.join(out,'candidate-context.json'),provenance);
    const options={repo,chapter,kind,out,preview,config:{...settings[kind],chapter},provenance};
    return ['manual','recovery','continue'].includes(kind)?await captureControls(options):await captureRuntime(options);
  } finally {
    if(owned){try{await owned.verify();}finally{owned.close();}}
  }
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const value=name=>{const i=process.argv.indexOf(`--${name}`);return i<0?undefined:process.argv[i+1];};
  try {await runCase({repo:path.resolve(value('repo')??path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')),
    chapter:value('chapter'),kind:value('case'),out:path.resolve(value('out')),preview:value('preview'),config:value('config'),build:process.argv.includes('--build')});}
  catch(e){console.error(`PROBE-ERROR-INCONCLUSIVE: ${e.message}`);process.exitCode=2;}
}
