export type ControlsDevice = 'desktop' | 'touch';
export type ControlsMode = 'overview' | 'fps' | 'build' | 'flight';

export interface ControlsReferenceContext {
  device: ControlsDevice;
  mode: ControlsMode;
  storyActive?: boolean;
  allowBuild?: boolean;
  allowCraft?: boolean;
  allowChart?: boolean;
  moveSpeedScale?: number;
  allowJump?: boolean;
  allowSprint?: boolean;
  lookMode?: 'free' | 'feed' | 'side';
}

export interface ControlReferenceAction {
  key: string;
  label: string;
}

export interface ControlReferenceSection {
  id: string;
  title: string;
  actions: ControlReferenceAction[];
}

const desktopGlobal: ControlReferenceAction[] = [
  { key: 'Esc', label: 'Pause / resume' }
];

const desktopOnFoot: ControlReferenceAction[] = [
  { key: 'WASD / Arrows', label: 'Move' },
  { key: 'Mouse', label: 'Look' },
  { key: 'Space', label: 'Jump / jetpack' },
  { key: 'Shift', label: 'Sprint' },
  { key: 'Ctrl / Z', label: 'Swim down' },
  { key: 'R', label: 'Reset position' }
];

const desktopInteraction: ControlReferenceAction[] = [
  { key: 'E', label: 'Mine / harvest' },
  { key: 'F', label: 'Use / interact / board' },
  { key: 'G', label: 'Eat / drink from waterskin' }
];

const desktopBuild: ControlReferenceAction[] = [
  { key: 'E', label: 'Place structure' },
  { key: 'X', label: 'Remove structure' },
  { key: 'R', label: 'Rotate structure' },
  { key: '1–0', label: 'Select piece' },
  { key: 'B', label: 'Exit build mode' }
];

const desktopShip: ControlReferenceAction[] = [
  { key: 'Mouse', label: 'Steer / look' },
  { key: 'W / S', label: 'Thrust / reverse' },
  { key: 'Shift', label: 'Boost' },
  { key: 'Q / E', label: 'Roll' },
  { key: 'Space', label: 'Launch' },
  { key: 'F', label: 'Land / exit ship' }
];

const touchOnFoot: ControlReferenceAction[] = [
  { key: 'Left stick', label: 'Move' },
  { key: 'Right side', label: 'Look' },
  { key: 'JUMP', label: 'Jump / jetpack' },
  { key: 'SPRINT', label: 'Hold to sprint' },
  { key: 'MINE', label: 'Mine / harvest' },
  { key: 'USE', label: 'Use / interact / board' }
];

const touchBuild: ControlReferenceAction[] = [
  { key: 'Left stick', label: 'Move' },
  { key: 'Right side', label: 'Look' },
  { key: 'PLACE', label: 'Place structure' },
  { key: 'REM', label: 'Remove structure' },
  { key: 'ROT', label: 'Rotate structure' },
  { key: 'JMP', label: 'Jump' }
];

const touchShip: ControlReferenceAction[] = [
  { key: 'Left stick', label: 'Forward / reverse' },
  { key: 'Right side', label: 'Look' },
  { key: 'THR', label: 'Boost while moving' },
  { key: 'L / R', label: 'Roll' },
  { key: 'LAND', label: 'Land / exit ship' }
];

function desktopSections(context: ControlsReferenceContext): ControlReferenceSection[] {
  const global = [...desktopGlobal];
  if (!context.storyActive && (context.mode === 'fps' || context.mode === 'overview')) {
    global.push({ key: 'M', label: 'Survey chart' });
  }

  const interaction = desktopInteraction.map(action => ({ ...action }));
  if (context.storyActive) {
    const useAction = interaction.find(action => action.key === 'F');
    if (useAction) useAction.label = 'Use / Story interaction';
  }
  if (context.allowCraft !== false) interaction.push({ key: 'C', label: 'Open Fabricator' });
  if (context.allowBuild !== false) interaction.push({ key: 'B', label: 'Enter build mode' });

  if (context.mode === 'flight') {
    return [
      { id: 'global', title: 'Global', actions: global },
      { id: 'ship', title: 'Ship flight · current', actions: desktopShip }
    ];
  }
  if (context.mode === 'build') {
    return [
      { id: 'global', title: 'Global', actions: global },
      { id: 'build', title: 'Build · current', actions: desktopBuild }
    ];
  }
  if (context.mode === 'fps') {
    const onFoot = currentOnFootActions(context);
    return [
      { id: 'global', title: 'Global', actions: global },
      { id: 'foot', title: 'On foot · current', actions: onFoot },
      ...(context.storyActive && context.moveSpeedScale === 0
        ? []
        : [{ id: 'interaction', title: 'Interaction / survival', actions: interaction }])
    ];
  }
  return [
    { id: 'global', title: 'Global', actions: global },
    { id: 'foot', title: 'On foot', actions: desktopOnFoot },
    { id: 'interaction', title: 'Interaction / survival', actions: interaction },
    { id: 'build', title: 'Build', actions: desktopBuild },
    { id: 'ship', title: 'Ship flight', actions: desktopShip }
  ];
}

function currentOnFootActions(context: ControlsReferenceContext): ControlReferenceAction[] {
  const actions: ControlReferenceAction[] = [];
  if (context.moveSpeedScale === 0) {
    actions.push({ key: '—', label: 'Movement held by Story' });
  } else if (context.lookMode === 'side') {
    actions.push({ key: 'A / D', label: 'Story movement' });
  } else {
    actions.push(desktopOnFoot[0]);
  }
  const lookMode = context.lookMode ?? 'free';
  actions.push({
    key: lookMode === 'side' ? '—' : 'Mouse',
    label: lookMode === 'free' ? 'Look' : lookMode === 'feed' ? 'Constrained survey' : 'Story camera'
  });
  if (context.allowJump !== false) actions.push(desktopOnFoot[2]);
  if (context.allowSprint !== false) actions.push(desktopOnFoot[3]);
  if (context.moveSpeedScale !== 0) actions.push(...desktopOnFoot.slice(4));
  return actions;
}

// Touch has no keyboard: the screen-actions section names the on-screen corner
// menu buttons (BUILD / FABRICATOR / CHART / PAUSE), never bare keycaps.
function touchGlobalActions(context: ControlsReferenceContext): ControlReferenceAction[] {
  const actions: ControlReferenceAction[] = [];
  if (context.mode !== 'flight' && context.allowBuild !== false) {
    actions.push({ key: 'BUILD', label: context.mode === 'build' ? 'Close build editor' : 'Open build editor' });
  }
  if (context.mode !== 'flight' && context.allowCraft !== false) {
    actions.push({ key: 'FABRICATOR', label: 'Open Fabricator' });
  }
  if (context.allowChart) {
    actions.push({ key: 'CHART', label: 'Survey chart' });
  }
  actions.push({ key: 'PAUSE', label: context.storyActive ? 'Pause / resume' : 'Pause / Star Map' });
  return actions;
}

function currentTouchOnFootActions(context: ControlsReferenceContext): ControlReferenceAction[] {
  if (context.moveSpeedScale === 0) {
    const held: ControlReferenceAction[] = [{ key: '—', label: 'Movement held by Story' }];
    if (context.lookMode === 'feed') held.push({ key: 'Right side', label: 'Constrained survey' });
    else if (context.lookMode === 'free') held.push({ key: 'Right side', label: 'Look' });
    else held.push({ key: '—', label: 'Story camera' });
    return held;
  }
  const actions: ControlReferenceAction[] = [{
    key: 'Left stick',
    label: context.lookMode === 'side' ? 'Left / right Story movement' : 'Move'
  }];
  if (context.lookMode === 'side') actions.push({ key: '—', label: 'Story camera' });
  else actions.push({ key: 'Right side', label: context.lookMode === 'feed' ? 'Constrained survey' : 'Look' });
  if (context.allowJump !== false) actions.push({ key: 'JUMP', label: 'Jump / jetpack' });
  // Sprint is opt-in: shown only where the policy explicitly grants it (the
  // embodied chapters + sandbox), never advertised on the feed/side eras.
  if (context.allowSprint === true) actions.push({ key: 'SPRINT', label: 'Hold to sprint' });
  actions.push(
    { key: 'MINE', label: 'Mine / harvest' },
    { key: 'USE', label: context.storyActive ? 'Use / Story interaction' : 'Use / interact / board' }
  );
  return actions;
}

function touchSections(context: ControlsReferenceContext): ControlReferenceSection[] {
  const global = { id: 'global', title: 'Screen actions', actions: touchGlobalActions(context) };
  if (context.mode === 'flight') return [global, { id: 'ship', title: 'Ship flight · current', actions: touchShip }];
  if (context.mode === 'build') return [global, { id: 'build', title: 'Build · current', actions: touchBuild }];
  if (context.mode === 'fps') {
    const foot = currentTouchOnFootActions(context);
    return [global, { id: 'foot', title: 'On foot · current', actions: foot }];
  }
  return [
    global,
    { id: 'foot', title: 'On foot', actions: touchOnFoot },
    { id: 'build', title: 'Build', actions: touchBuild },
    { id: 'ship', title: 'Ship flight', actions: touchShip }
  ];
}

export function createControlsReference(context: ControlsReferenceContext): ControlReferenceSection[] {
  return context.device === 'touch' ? touchSections(context) : desktopSections(context);
}
