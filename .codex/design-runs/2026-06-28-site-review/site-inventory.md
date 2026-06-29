# Site Inventory

This inventory treats Paravoxia as an app/game shell rather than a traditional website.

| Surface | Owner | User goal | Primary action | Known states | Screenshot status |
| --- | --- | --- | --- | --- | --- |
| Landing menu | `LandingMenu.tsx` | Start the game from a cinematic live world | Play Now | loading/generating, ready, leaving, graphics panel, controls panel, audio panel, co-op panel | current desktop landing/controls/graphics captured |
| Landing controls panel | `LandingMenu.tsx` | Learn basic controls before play | Read controls | desktop copy, touch copy | captured desktop; static only |
| Landing graphics panel | `LandingMenu.tsx` | Pick performance/cinematic quality | Select profile | ULTRA/HIGH/MEDIUM/LOW/POTATO | captured desktop |
| Landing audio panel | `LandingMenu.tsx`, `AudioControls.tsx` | Adjust audio before play | Change volume/toggles | compact audio controls | source reviewed |
| Landing co-op panel | `LandingMenu.tsx`, `CoopPanel.tsx` | Create or join an alpha room | Create room / Join | disabled, config missing, busy, connected, error, closed | source reviewed |
| Gameplay HUD: on-foot desktop | `App.tsx`, `components/hud/*` | Survive, mine, build, navigate, and read status | Move/interact/mine/build/craft/pause | vitals, inventory, minimap, prompts, mining, build, co-op, looked-at | prior desktop HUD screenshot |
| Gameplay HUD: on-foot touch | `TouchControls.tsx`, HUD components | Play with thumbs without overlap | Move/look/jump/use/mine | joystick, action cluster, collapsed/open inventory, build active | prior mobile HUD screenshots |
| HUD corner actions | `HudCornerActions.tsx` | Open build, fabricator, star map quickly | B/C/M buttons | foot mode, flight mode, build active | source reviewed |
| Suit telemetry | `VitalsMeter.tsx` | Monitor survival and capability | Passive glance | health, food, water, temp, stamina, oxygen, jetpack, Maw if owned | prior screenshot and tests |
| Inventory | `InventoryPanel.tsx` | Inspect carried items without crowding screen | Expand/collapse | empty, grouped resources/equipment, open/closed | prior mobile open screenshot |
| Interaction prompt | `InteractionPrompt.tsx`, `interactionSystem.ts` | Understand current context action | Press/tap interact | door, board, drink, none | source reviewed |
| Mining progress | `MiningProgress.tsx` | Know hold-to-mine state | Hold mine | active, blocked, complete | source reviewed |
| Build indicator desktop | `BuildIndicator.tsx` | Select/place/remove structures | Number select, E place, X remove | build off/on, selected piece, blocked ghost | source reviewed |
| Mobile build editor | `BuildIndicator.tsx` | Build on touch | Select piece/material/place/remove/rotate/close | palette, material rail, rotate, close | source reviewed |
| Fabricator | `CraftingPanel.tsx` | Craft known recipes | Craft | affordable, unaffordable, campfire place, grouped stations | source reviewed |
| Pause/star map | `PauseMenu.tsx` | Pause, travel, settings, quit | Resume / Set Course | star map, graphics, audio, nearby, previous disabled | source reviewed; no controls section |
| Cockpit readout | `CockpitReadout.tsx` | Fly/land/warp with mode hints | Launch/land/warp | parked surface, descent, deep space; desktop/touch copy | source reviewed |
| Target reticle | `TargetReticle.tsx` | Confirm warp target engagement | Hold forward | lock, waiting for fresh forward, engaging | source reviewed |
| Orbital minimap | `OrbitalMinimap.tsx` | Track orientation and nearby markers | Passive glance | face, local marker, remote players, ship, structures, campfires | source reviewed |
| Multiplayer status badge | `MultiplayerStatusBadge.tsx` | Know co-op connection state | Passive glance | connected, error, busy, hidden offline | source reviewed |
| Developer overlays | `App.tsx` debug UI | Inspect runtime in debug mode | Toggle panels/colliders/course | desktop/mobile debug, hidden/shown | source reviewed; out of production scope |

## Missing Inventory Items

- Reusable Controls/Binds panel shared by landing and pause.
- Dedicated in-game controls affordance in the HUD quick-action cluster.
- Control remapping/capture state.
- Binding conflict, restore-defaults, and unsaved-change states.
- First-run or mode-transition hints for hidden actions.
- In-game co-op management beyond landing panel and status badge.
- Explicit modal focus-trap and keyboard-return contract.
