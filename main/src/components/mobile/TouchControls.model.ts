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

/** Grid gutter, shared by the template strings and the measured metrics. */
export const TOUCH_ACTION_GRID_GAP_PX = 8;

/**
 * Below this viewport width the flat sprint cluster would reach far enough
 * left to meet the joystick, so the narrow phone keeps the taller stack. The
 * caption lane reads the real height either way, so both are safe — this only
 * decides which axis the cluster spends.
 */
export const TOUCH_ACTION_FLAT_MIN_WIDTH_PX = 360;

/**
 * The cluster's occupied rect, in px, derived from the SAME template the grid
 * renders. Nothing else may hand-copy these numbers.
 *
 * The caption lane used to clear a hand-copied `174`, which was the no-sprint
 * cluster's 152 height plus a margin. Sprint adds a whole row, so on every
 * sprint-enabled beat — chapters 3 through 10 and free play, i.e. most of the
 * game — the cluster stood 226 tall and captions were drawn straight across
 * the SPRINT and JUMP buttons. Deriving the lane from this function is what
 * stops that class of bug from returning.
 */
export function touchActionClusterMetrics(
  controlMode: TouchControlMode,
  buildActive: boolean,
  allowSprint = false,
  viewportWidth = Number.POSITIVE_INFINITY
): { width: number; height: number } {
  const grid = createTouchActionGrid(controlMode, buildActive, allowSprint, viewportWidth);
  return {
    width: trackTotal(grid.templateColumns),
    height: trackTotal(grid.templateRows)
  };
}

function trackTotal(template: string): number {
  const tracks = template.trim().split(/\s+/).map(track => Number.parseFloat(track));
  if (tracks.length === 0 || tracks.some(track => !Number.isFinite(track))) return 0;
  return tracks.reduce((sum, track) => sum + track, 0)
    + TOUCH_ACTION_GRID_GAP_PX * (tracks.length - 1);
}

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
  allowSprint = false,
  viewportWidth = Number.POSITIVE_INFINITY
): TouchActionGrid {
  if (controlMode === 'fps' && !buildActive) {
    if (allowSprint) {
      // FIVE buttons, spent along the WIDE axis rather than the tall one.
      //
      // The stack this replaces was 226px tall, which put CONSUME and USE most
      // of the way up the lower third of a phone — an awkward reach, and it ate
      // the band captions want. Flat, the same five commands stand 152 tall:
      // the thumb travels less and the frame gets its lower third back.
      if (viewportWidth >= TOUCH_ACTION_FLAT_MIN_WIDTH_PX) {
        return {
          templateColumns: '66px 66px 78px',
          templateRows: '66px 78px',
          templateAreas: '"eat use sprint" ". mine primary"'
        };
      }
      // Narrow phones keep the tall stack rather than reach into the joystick.
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
