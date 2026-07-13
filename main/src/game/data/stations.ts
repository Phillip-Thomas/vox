// --- Crafting stations -------------------------------------------------------
//
// A station is WHERE a recipe can be crafted. Recipes name a station; the player
// can only run a recipe whose station they currently have access to. This is the
// seam for base-building later: today the player carries a "portable fabricator"
// that grants every station (getAccessibleStations returns all), but once
// placeable stations exist, access narrows to "stations within reach", with no
// change to recipes or the crafting engine.

export type StationId = 'hand' | 'smelter' | 'assembler' | 'survey_console';

export interface StationDefinition {
  id: StationId;
  name: string;
  description: string;
}

export const STATIONS: Record<StationId, StationDefinition> = {
  hand: {
    id: 'hand', name: 'Field Kit',
    description: 'Basic on-the-spot fabrication with no station required.'
  },
  smelter: {
    id: 'smelter', name: 'Smelter',
    description: 'Reduces raw ore and grit into refined ingots, panes, and cells.'
  },
  assembler: {
    id: 'assembler', name: 'Assembler',
    description: 'Builds components, tools, suits, and modules from refined stock.'
  },
  survey_console: {
    id: 'survey_console', name: 'Survey Console',
    description: 'Tunes scanning optics — the home of Survey Lens upgrades.'
  }
};

export const ALL_STATION_IDS = Object.keys(STATIONS) as StationId[];
export const PORTABLE_DEMO_STATION_IDS: readonly StationId[] = ['hand'];

export function getStation(id: StationId): StationDefinition {
  return STATIONS[id];
}

/**
 * Public demo station access. Advanced stations remain data/internal capability
 * until later story systems introduce them honestly as placeable progression.
 */
export function getAccessibleStations(): StationId[] {
  return [...PORTABLE_DEMO_STATION_IDS];
}
