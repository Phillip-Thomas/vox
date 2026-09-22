import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {earnedReviewEntry} from './review-entry.mjs';import {writeJson,reference,readJson} from './store.mjs';
test('earned player entry keeps saved values, relocates only the verified origin and rejects failed or foreign evidence',t=>{
 const repo=fs.mkdtempSync(path.join(os.tmpdir(),'earned-player-'));t.after(()=>fs.rmSync(repo,{recursive:true,force:true}));
 const storage=path.join(repo,'storage.json'),report=path.join(repo,'report.json'),output=path.join(repo,'player.json');
 const original={cookies:[],origins:[{origin:'http://127.0.0.1:4000',localStorage:[{name:'earned',value:'unchanged { record }'}]}]};writeJson(storage,original);
 const source=reference(repo,storage),data={kind:'continue',chapter:'ch14',status:'passed',candidateSha256:'candidate',proof:{stateEqual:true,clickedContinue:true,newAcceptedAction:1},raw:[source],reviewEntry:{chapter:'ch14',beat:'ch14-scar',origin:'http://127.0.0.1:4000',storageState:source}};writeJson(report,data);
 const entry=earnedReviewEntry(repo,report,'candidate','http://127.0.0.1:5000/',output);assert.equal(entry.kind,'normal-save');assert.ok(!entry.url.includes('story='));assert.deepEqual(readJson(output).origins[0].localStorage,original.origins[0].localStorage);assert.equal(readJson(output).origins[0].origin,'http://127.0.0.1:5000');
 assert.throws(()=>earnedReviewEntry(repo,report,'different','http://127.0.0.1:5000/',output),/candidate/);
 writeJson(report,{...data,proof:{...data.proof,newAcceptedAction:0}});assert.throws(()=>earnedReviewEntry(repo,report,'candidate','http://127.0.0.1:5000/',output),/new-action/);
 writeJson(report,data);writeJson(storage,{...original,cookies:[{name:'foreign'}]});assert.throws(()=>earnedReviewEntry(repo,report,'candidate','http://127.0.0.1:5000/',output));
});
