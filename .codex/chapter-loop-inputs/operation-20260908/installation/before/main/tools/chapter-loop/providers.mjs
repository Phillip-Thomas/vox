import { requireThat, emptyUsage } from './contract.mjs';

export function providerCommand(binding, { prompt, system, output, role, remainingTurns }) {
  requireThat(['claude', 'codex'].includes(binding.provider), 'Supported providers: claude, codex');
  const model = binding.models?.[role.lane];
  requireThat(typeof model === 'string' && model.length > 0, `Explicit ${role.lane} model required`);
  if (binding.provider === 'claude') {
    const tools = role.blind ? 'Read,Bash' : role.writes ? 'Read,Grep,Glob,Bash,Write,Edit' : 'Read,Grep,Glob,Bash';
    return {
      command: 'claude', args: ['-p', '--model', model, '--safe-mode', '--output-format', 'stream-json', '--verbose',
        '--include-partial-messages', '--no-session-persistence', '--strict-mcp-config', '--setting-sources', '',
        '--permission-mode', 'default', '--tools', tools, '--allowedTools', tools, '--system-prompt', system],
      input: prompt, model,
    };
  }
  // Same local adapter pattern as Paraform; no inherited project instructions or transcript.
  return {
    command: 'codex', args: ['exec', '--ephemeral', '--ignore-user-config', '--skip-git-repo-check', '--json',
      '-c', 'project_doc_max_bytes=0', '-c', 'approval_policy="never"',
      '-c', 'features.multi_agent=false', '-c', `developer_instructions=${JSON.stringify(system)}`,
      '--sandbox', role.writes || role.blind ? 'workspace-write' : 'read-only', '--model', model, '--output-last-message', output, '-'],
    input: prompt, model, remainingTurns,
  };
}

// Normalize actual telemetry. Never count both Claude message usage and its cumulative result.
export function usageTracker(provider) {
  const measured = emptyUsage();
  let session = null, resolved = null, completed = false, failed = false, final = '', context = 0, reported = false;
  const messages = new Map();
  let rawTurns = 0;
  function update(message, usage) {
    const key = message?.id;
    if (!key || !usage) return;
    const old = messages.get(key) ?? {};
    messages.set(key, { ...old, ...usage });
    context = Math.max(context, (usage.input_tokens ?? old.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? old.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? old.cache_read_input_tokens ?? 0));
    measured.inputTokens = 0; measured.cacheReadTokens = 0; measured.outputTokens = 0;
    for (const u of messages.values()) {
      measured.inputTokens += (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
      measured.cacheReadTokens += u.cache_read_input_tokens ?? 0;
      measured.outputTokens += u.output_tokens ?? 0;
    }
    measured.modelTurns = messages.size;
    reported = true;
  }
  let currentMessage = null;
  return {
    ingest(line) {
      let event;
      try { event = JSON.parse(line); } catch { return null; }
      if (provider === 'claude') {
        if (event.type === 'system' && event.subtype === 'init') { session = event.session_id; resolved = event.model; }
        if (event.type === 'stream_event') {
          const e = event.event;
          if (e?.type === 'message_start') { currentMessage = e.message; update(currentMessage, e.message.usage); }
          if (e?.type === 'message_delta') update(currentMessage, e.usage);
        }
        if (event.type === 'assistant') {
          update(event.message, event.message?.usage);
          final = (event.message?.content ?? []).filter(x => x.type === 'text').map(x => x.text).join('\n');
        }
        if (event.type === 'result') {
          failed = Boolean(event.is_error); completed = !failed; session ??= event.session_id;
          if (event.usage) {
            const u = event.usage;
            measured.inputTokens = Math.max(measured.inputTokens, (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0));
            measured.cacheReadTokens = Math.max(measured.cacheReadTokens, u.cache_read_input_tokens ?? 0);
            measured.outputTokens = Math.max(measured.outputTokens, u.output_tokens ?? 0);
            measured.modelTurns = Math.max(measured.modelTurns, event.num_turns ?? 0);
            reported = true;
          }
          final = event.structured_output ? JSON.stringify(event.structured_output) : event.result ?? final;
        }
      } else {
        if (event.type === 'thread.started') session = event.thread_id;
        if (event.type === 'item.completed') {
          rawTurns++;
          if (event.item?.type === 'agent_message') final = event.item.text;
          measured.modelTurns = Math.max(measured.modelTurns, rawTurns);
        }
        if (event.type === 'turn.completed') {
          completed = true;
          const u = event.usage;
          if (u) {
            measured.inputTokens += Math.max(0, (u.input_tokens ?? 0) - (u.cached_input_tokens ?? 0));
            measured.cacheReadTokens += u.cached_input_tokens ?? 0;
            measured.outputTokens += u.output_tokens ?? 0;
            reported = true;
          }
        }
        if (event.type === 'turn.failed') failed = true;
      }
      return { ...measured };
    },
    result: () => ({ usage: { ...measured }, session, resolved, completed: completed && !failed, failed, final, contextTokens: context, reported,
      accounting: provider === 'codex' ? 'Token usage arrives at turn completion; item count is a conservative work-step limit, not an exact API-call count.' : 'Live per-message usage, reconciled to cumulative terminal usage.' }),
  };
}
