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

export function createTouchActionSpecs(controlMode: TouchControlMode, buildActive: boolean): TouchActionSpec[] {
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
    { id: 'use', label: 'USE', ariaLabel: 'Use or interact', code: KEY_CODES.board, intent: 'secondary', area: 'use' },
    { id: 'mine', label: 'MINE', ariaLabel: 'Mine', code: KEY_CODES.mine, intent: 'secondary', area: 'mine' },
    { id: 'jump', label: 'JUMP', ariaLabel: 'Jump', code: KEY_CODES.jump, intent: 'primary', area: 'primary' }
  ];
}

export function createTouchActionGrid(controlMode: TouchControlMode, buildActive: boolean): TouchActionGrid {
  if (controlMode === 'fps' && !buildActive) {
    return {
      templateColumns: '66px 78px',
      templateRows: '66px 78px',
      templateAreas: '". use" "mine primary"'
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
