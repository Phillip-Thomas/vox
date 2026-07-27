import { KEY_CODES } from '../../utils/mobileInput.ts';

export type TouchControlMode = 'fps' | 'flight';
export type TouchActionIntent = 'primary' | 'secondary';

export type TouchActionSpec = {
  id: string;
  label: string;
  ariaLabel: string;
  code: string;
  intent: TouchActionIntent;
  area: string;
};

export type TouchActionGrid = {
  templateColumns: string;
  templateRows: string;
  templateAreas: string;
};

/** The desktop-Shift equivalent: a hold-to-sprint button for the on-foot grid. */
export const TOUCH_SPRINT_ACTION: TouchActionSpec = {
  id: 'sprint',
  label: 'SPRINT',
  ariaLabel: 'Hold to sprint',
  code: KEY_CODES.sprint,
  intent: 'secondary',
  area: 'sprint'
};

export function createTouchActionSpecs(
  controlMode: TouchControlMode,
  buildActive: boolean,
  allowSprint = false
): TouchActionSpec[] {
  if (controlMode === 'flight') {
    return [
      { id: 'roll-left', label: 'L', ariaLabel: 'Roll left', code: KEY_CODES.rollLeft, intent: 'secondary', area: 'rollLeft' },
      { id: 'roll-right', label: 'R', ariaLabel: 'Roll right', code: KEY_CODES.rollRight, intent: 'secondary', area: 'rollRight' },
      { id: 'land', label: 'LAND', ariaLabel: 'Land or board ship', code: KEY_CODES.board, intent: 'secondary', area: 'land' },
      { id: 'thrust', label: 'THR', ariaLabel: 'Thrust', code: KEY_CODES.jump, intent: 'primary', area: 'primary' }
    ];
  }

  if (buildActive) {
    return [
      { id: 'remove', label: 'REM', ariaLabel: 'Remove structure', code: KEY_CODES.deconstruct, intent: 'secondary', area: 'remove' },
      { id: 'rotate', label: 'ROT', ariaLabel: 'Rotate structure', code: KEY_CODES.buildRotate, intent: 'secondary', area: 'rotate' },
      { id: 'jump', label: 'JMP', ariaLabel: 'Jump', code: KEY_CODES.jump, intent: 'secondary', area: 'jump' },
      { id: 'place', label: 'PLACE', ariaLabel: 'Place structure', code: KEY_CODES.mine, intent: 'primary', area: 'primary' }
    ];
  }

  return [
    { id: 'eat', label: 'CONSUME', ariaLabel: 'Consume held food or waterskin', code: KEY_CODES.eat, intent: 'secondary', area: 'eat' },
    { id: 'use', label: 'USE', ariaLabel: 'Use or interact', code: KEY_CODES.board, intent: 'secondary', area: 'use' },
    { id: 'mine', label: 'MINE', ariaLabel: 'Mine', code: KEY_CODES.mine, intent: 'secondary', area: 'mine' },
    // Sprint only appears where the story policy allows it (embodied chapters).
    ...(allowSprint ? [TOUCH_SPRINT_ACTION] : []),
    { id: 'jump', label: 'JUMP', ariaLabel: 'Jump', code: KEY_CODES.jump, intent: 'primary', area: 'primary' }
  ];
}

export function createTouchActionGrid(
  controlMode: TouchControlMode,
  buildActive: boolean,
  allowSprint = false
): TouchActionGrid {
  if (controlMode === 'fps' && !buildActive) {
    // The sprint button adds a third row (sprint above the JUMP anchor); without
    // it the on-foot cluster keeps its compact bottom-right 2x2 right angle.
    if (allowSprint) {
      return {
        templateColumns: '66px 78px',
        templateRows: '66px 66px 78px',
        templateAreas: '"eat use" "mine sprint" ". primary"'
      };
    }
    return {
      templateColumns: '66px 78px',
      templateRows: '66px 78px',
      templateAreas: '"eat use" "mine primary"'
    };
  }

  if (controlMode === 'flight') {
    return {
      templateColumns: '66px 78px',
      templateRows: '66px 78px',
      templateAreas: '"rollLeft rollRight" "land primary"'
    };
  }

  return {
    templateColumns: '66px 78px',
    templateRows: '66px 78px',
    templateAreas: '"remove rotate" "jump primary"'
  };
}

/**
 * Action codes still held by a finger whose button just LEFT the on-screen grid:
 * SPRINT hidden when build mode opens or the story policy revokes allowSprint, or
 * the whole cluster swapping on a build / control-mode change. React unmounts the
 * removed <button> without a pointerup (the pointer was captured on it), so the
 * synthetic key (e.g. ShiftLeft) would latch into a non-stop sprint — the same
 * disappear-while-held latch class as the D-PAD EXTRACT bug. A code shared by a
 * surviving button (mine's KeyE is also build-place's KeyE) is NOT stale: it is
 * still bound to a live button, so the hold carries over correctly.
 */
export function staleHeldTouchActionCodes(
  heldCodes: Iterable<string>,
  controlMode: TouchControlMode,
  buildActive: boolean,
  allowSprint: boolean
): string[] {
  const live = new Set(
    createTouchActionSpecs(controlMode, buildActive, allowSprint).map(action => action.code)
  );
  return [...heldCodes].filter(code => !live.has(code));
}
