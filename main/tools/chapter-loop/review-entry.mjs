import path from 'node:path';
import {requireThat} from './contract.mjs';
import {readJson,checkRef,reference,writeJson} from './store.mjs';

export function earnedReviewEntry(repo,reportFile,candidate,previewUrl,output) {
 const report=readJson(reportFile),entry=report.reviewEntry;
 requireThat(report.kind==='continue'&&report.status==='passed'&&report.candidateSha256===candidate
  &&report.proof.stateEqual&&report.proof.clickedContinue&&report.proof.newAcceptedAction>0,'Player entry requires passed Continue equality and new-action proof for this candidate');
 requireThat(entry?.chapter===report.chapter&&entry.beat?.startsWith(report.chapter+'-')&&entry.storageState,'Earned chapter checkpoint required');
 requireThat(report.raw.some(r=>r.path===entry.storageState.path&&r.sha256===entry.storageState.sha256),'Checkpoint must be bound in the captured raw artifacts');
 const storage=readJson(checkRef(repo,entry.storageState)),oldOrigin=new URL(entry.origin).origin,newOrigin=new URL(previewUrl).origin;
 requireThat(storage.cookies?.length===0&&storage.origins?.length===1&&storage.origins[0].origin===oldOrigin,'Only the isolated game profile may become the player entry');
 // A new immutable preview port is a new browser origin. Relocate the origin
 // only; saved values remain byte-for-byte the ordinarily earned checkpoint.
 const copy={...storage,origins:[{...storage.origins[0],origin:newOrigin}]};writeJson(output,copy);
 return {kind:'normal-save',url:new URL('/?journeyprobe=1&profile=HIGH',previewUrl).href,storageState:reference(repo,output),storageStateFile:path.resolve(output),
  browser:{playwrightModule:path.join(repo,'main/node_modules/playwright-core/index.mjs'),executablePath:process.env.CHROME_PATH??'/snap/bin/chromium',headless:false,env:{DISPLAY:process.env.DISPLAY??':0'},args:['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle','--use-angle=gl','--disable-background-timer-throttling','--disable-renderer-backgrounding']},
  sourceCheckpoint:entry.storageState,sourceProof:reference(repo,reportFile),chapter:entry.chapter,beat:entry.beat,
  instructions:'Create your owned Playwright browser context with this storageState file, navigate to the URL, and click the visible Continue button. It is an actual checkpoint earned by normal inputs and verified by Continue. Do not edit saved values. Judge your own subsequent play; the supplied save does not prove fresh full-story entry.'};
}
