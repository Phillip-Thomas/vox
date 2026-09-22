import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { perceptionScope, allowedMedia, perceive } from './perceive-media.mjs';
import { reference, writeJson, readJson } from './store.mjs';
import { validateMediaBindingRecovery } from './runner.mjs';

test('native perception admits only supplied media, sends real bytes, records usage and retains API failures', async t => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'perceive-media-')); t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const audio = path.join(repo, 'test.wav');
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.1', audio]);
  const ref = { ...reference(repo, audio), kind: 'audio' }, scope = perceptionScope(repo, repo, 'av', repo, [ref]);
  const scopeFile = path.join(repo, 'scope.json'); writeJson(scopeFile, scope);
  assert.equal(allowedMedia(scope, audio).sha256, ref.sha256);
  const other = path.join(repo, 'hidden.wav'); fs.copyFileSync(audio, other);
  assert.throws(() => allowedMedia(scope, other), /outside/);
  const fetcher = async (url, options) => {
    assert.match(url, /^https:\/\/generativelanguage.googleapis.com/);
    const body = JSON.parse(options.body);
    assert.ok(body.contents[0].parts[1].inlineData.data.length > 100);
    assert.equal(body.contents[0].parts[1].inlineData.mimeType, 'audio/mp3');
    assert.equal(body.contents[0].parts[0].text, 'What is audible?');
    assert.ok(!options.body.includes('hidden.wav'));
    return { ok: true, json: async () => ({ modelVersion: scope.model, usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 2 }, candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Synthetic perception fixture only; not a real audition.' }] } }] }) };
  };
  const result = await perceive({ scopeFile, file: audio, question: 'What is audible?' }, { key: 'test-key', fetcher });
  assert.equal(result.status, 'observed'); assert.equal(result.source.sha256, ref.sha256);
  assert.equal(readJson(result.receiptFile).usage.promptTokenCount, 10);
  await assert.rejects(perceive({ scopeFile, file: audio, question: 'What is audible?' }, { key: '', fetcher }), /unavailable/);
  await assert.rejects(perceive({ scopeFile, file: audio, question: 'What is audible?' }, { key: 'test-key', fetcher: async () => ({ ok: false, status: 429, json: async () => ({ error: { status: 'RESOURCE_EXHAUSTED' } }) }) }), /429/);
  const receipts = fs.readdirSync(path.join(repo, 'perception')).filter(n => n.endsWith('.json')).map(n => readJson(path.join(repo, 'perception', n)));
  assert.ok(receipts.some(r => r.status === 'inconclusive' && /429/.test(r.error)));
  fs.appendFileSync(audio, 'changed'); assert.throws(() => allowedMedia(scope, audio), /changed/);
});

test('media repair cannot reopen a creative revise or a composer that already had a listening binding', t => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'media-repair-')); t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const resultFile = path.join(repo, 'result.json');
  writeJson(resultFile, { verdict: 'REVISE', session: 'one' }); writeJson(path.join(repo, 'packet.json'), {});
  writeJson(path.join(repo, 'transport.json'), { completed: true, reported: true, session: 'one' });
  const state = { status: 'NEEDS_REVISION', queue: ['compose', 'verify'], cursor: 1, receipts: { compose: reference(repo, resultFile) } };
  let repair = { blockedRole: { stage: 'compose', result: state.receipts.compose } };
  assert.throws(() => validateMediaBindingRecovery(repo, state, repair), /completed composer lacking/);
  writeJson(resultFile, { verdict: 'BLOCKED', session: 'one' }); state.receipts.compose = reference(repo, resultFile); repair.blockedRole.result = state.receipts.compose;
  writeJson(path.join(repo, 'packet.json'), { mediaPerception: { available: true } });
  assert.throws(() => validateMediaBindingRecovery(repo, state, repair), /completed composer lacking/);
});
