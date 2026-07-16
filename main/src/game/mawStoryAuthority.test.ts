import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandContext } from './commands.ts';
import { dispatchStoryAuthorityCommand } from './storyAuthorityDispatch.ts';
import { isMultiplayerAuthoritativeCommandUnsettled } from './multiplayerSession.ts';

vi.mock('./storyAuthorityDispatch.ts', () => ({
  dispatchStoryAuthorityCommand: vi.fn(() => 'pending')
}));
vi.mock('./multiplayerSession.ts', () => ({
  isMultiplayerAuthoritativeCommandUnsettled: vi.fn(() => false)
}));
vi.mock('./commandDispatchAdapter.ts', () => ({
  resolveMultiplayerCommandLane: vi.fn(() => 'online')
}));
import {
  MAW_STORY_AUTHORITY_COMMAND_TYPES,
  dispatchMawFirstDirectionAuthority,
  dispatchMawPondObservationBeginOnceAuthority,
  dispatchMawPondResonanceTransactionAuthority,
  mawFirstDirectionAuthorityCommand,
  mawPondObservationBeginAuthorityCommand,
  mawPondResonanceAuthorityCommand,
  resetMawPondAuthorityTransactions
} from './mawStoryAuthority.ts';

describe('Maw multiplayer authority command contracts', () => {
  beforeEach(() => {
    vi.mocked(dispatchStoryAuthorityCommand).mockClear();
    vi.mocked(isMultiplayerAuthoritativeCommandUnsettled).mockReset();
    vi.mocked(isMultiplayerAuthoritativeCommandUnsettled).mockReturnValue(false);
    resetMawPondAuthorityTransactions();
  });

  it('deduplicates per-frame pond begin and completion sends through the echo window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    try {
      const context = {
        actorId: 'alice',
        world: { worldId: '-1,-1' }
      } as CommandContext;
      expect(dispatchMawPondObservationBeginOnceAuthority(context, 'pond:complete')).toBe('pending');
      expect(dispatchMawPondObservationBeginOnceAuthority(context, 'pond:complete')).toBe('pending');
      expect(dispatchStoryAuthorityCommand).toHaveBeenCalledTimes(1);

      expect(dispatchMawPondResonanceTransactionAuthority(context, 'pond:complete')).toBe('pending');
      vi.advanceTimersByTime(650);
      expect(dispatchStoryAuthorityCommand).toHaveBeenCalledTimes(2);
      expect(dispatchMawPondResonanceTransactionAuthority(context, 'pond:complete')).toBe('pending');
      expect(dispatchStoryAuthorityCommand).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(1_001);
      expect(dispatchMawPondResonanceTransactionAuthority(context, 'pond:complete')).toBe('pending');
      expect(dispatchStoryAuthorityCommand).toHaveBeenCalledTimes(3);
    } finally {
      resetMawPondAuthorityTransactions();
      vi.useRealTimers();
    }
  });

  it('sends only the canonical first-direction branch choice', () => {
    expect(mawFirstDirectionAuthorityCommand(
      ' story:maw:first-direction ',
      'harmless-test'
    )).toEqual({
      commandId: 'story:maw:first-direction',
      commandType: MAW_STORY_AUTHORITY_COMMAND_TYPES.firstDirection,
      payload: { choice: 'harmless-test' }
    });
    expect(mawFirstDirectionAuthorityCommand('', 'lowered-and-listened')).toBeNull();
  });

  it('does not resend a stable direction command before its authoritative echo', () => {
    vi.mocked(isMultiplayerAuthoritativeCommandUnsettled).mockReturnValue(true);
    const context = {
      actorId: 'alice',
      world: { worldId: '-1,-1' }
    } as CommandContext;
    expect(dispatchMawFirstDirectionAuthority(
      context,
      'story:maw:first-direction',
      'lowered-and-listened'
    )).toBe('pending');
    expect(dispatchStoryAuthorityCommand).not.toHaveBeenCalled();
  });

  it('binds pond completion to a distinct accepted observation-begin command', () => {
    expect(mawPondObservationBeginAuthorityCommand('pond:observe:1')).toEqual({
      commandId: 'pond:observe:1',
      commandType: MAW_STORY_AUTHORITY_COMMAND_TYPES.pondObservationBegin,
      payload: {}
    });
    expect(mawPondResonanceAuthorityCommand('pond:complete', 'pond:observe:1')).toEqual({
      commandId: 'pond:complete',
      commandType: MAW_STORY_AUTHORITY_COMMAND_TYPES.pondResonance,
      payload: { observationBeginCommandId: 'pond:observe:1' }
    });
    expect(mawPondResonanceAuthorityCommand('pond:complete', ' ')).toBeNull();
  });
});
