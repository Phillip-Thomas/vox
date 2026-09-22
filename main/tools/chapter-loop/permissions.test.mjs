import test from 'node:test';
import assert from 'node:assert/strict';
import {providerCommand} from './providers.mjs';
const role={lane:'mechanical',blind:true};
const inputs={prompt:'{}',system:'commission',output:'/tmp/output',role,remainingTurns:5};
test('explicit full permission authority reaches both fresh provider transports',()=>{
  const claude=providerCommand({provider:'claude',permissionMode:'full',models:{mechanical:'opus'}},inputs);
  assert.equal(claude.args[claude.args.indexOf('--permission-mode')+1],'bypassPermissions');
  const codex=providerCommand({provider:'codex',permissionMode:'full',models:{mechanical:'specified-model'}},inputs);
  assert.ok(codex.args.includes('--dangerously-bypass-approvals-and-sandbox'));
  assert.equal(codex.args.includes('--sandbox'),false);
});
test('old pinned bindings retain their original permissions without new authority',()=>{
  const claude=providerCommand({provider:'claude',models:{mechanical:'opus'}},inputs);
  assert.equal(claude.args[claude.args.indexOf('--permission-mode')+1],'default');
  const codex=providerCommand({provider:'codex',models:{mechanical:'specified-model'}},inputs);
  assert.equal(codex.args.includes('--dangerously-bypass-approvals-and-sandbox'),false);
  assert.equal(codex.args[codex.args.indexOf('--sandbox')+1],'workspace-write');
});
