import fs from 'node:fs';
import { spawn } from 'node:child_process';

// One process-group owner for models and commands. No global browser/process kills.
export function runProcess(command, args, { cwd, env = {}, input = '', log, timeoutMs, onLine = () => {}, shouldStop = () => false, maxBytes = 32_000_000, onStart = () => {} }) {
  return new Promise(resolve => {
    const output = fs.createWriteStream(log, { flags: 'wx' });
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let reason = null, bytes = 0, pending = '', hardKill = null, ended = false;
    const signalGroup = signal => { try { process.kill(-child.pid, signal); } catch { /* already reaped */ } };
    const stop = why => {
      if (reason || ended) return;
      reason = why;
      signalGroup('SIGTERM');
      hardKill = setTimeout(() => signalGroup('SIGKILL'), 5000);
      hardKill.unref();
    };
    const interrupted = () => stop('owner-stop');
    process.on('SIGTERM', interrupted); process.on('SIGINT', interrupted);
    const timer = setTimeout(() => stop('deadline'), Math.max(1, timeoutMs));
    const poll = setInterval(() => { try { const why = shouldStop(); if (why) stop(typeof why === 'string' ? why : 'owner-stop'); } catch (error) { stop(`control-error: ${error.message}`); } }, 250);
    const consume = chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) { stop('transcript-limit'); return; }
      output.write(chunk);
      pending += chunk.toString();
      const lines = pending.split('\n'); pending = lines.pop();
      for (const line of lines) {
        try { const why = onLine(line); if (why) stop(why); }
        catch (error) { stop(`invalid-stream: ${error.message}`); }
      }
    };
    child.stdout.on('data', consume);
    child.stderr.on('data', chunk => { bytes += chunk.length; if (bytes <= maxBytes) output.write(chunk); else stop('transcript-limit'); });
    child.stdin.on('error', () => {});
    child.on('spawn', () => { try { onStart(child.pid); child.stdin.end(input); } catch (error) { stop(`start-error: ${error.message}`); } });
    const finish = (code, signal, error) => {
      if (ended) return; ended = true;
      if (pending.trim()) { try { onLine(pending); } catch (e) { reason ??= `invalid-stream: ${e.message}`; } }
      clearTimeout(timer); clearInterval(poll); clearTimeout(hardKill);
      process.removeListener('SIGTERM', interrupted); process.removeListener('SIGINT', interrupted);
      // A parent exit does not license leaving a background process in its group.
      signalGroup('SIGKILL');
      output.end(() => resolve({ exitCode: code, signal, error: error?.message, reason, bytes, pid: child.pid }));
    };
    child.on('error', error => finish(null, null, error));
    child.on('close', (code, signal) => finish(code, signal));
  });
}
