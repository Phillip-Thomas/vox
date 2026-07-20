# Screenshot Report

## Run

- Repo: `/home/thomasphillip/Projects/vox`
- Surface: Paravoxia embodied-story mobile HUD, using `ch5-maw` as the representative objective/marker route.
- Commit/branch: mixed user worktree; no commit created.
- Canonical preview URL: `http://127.0.0.1:5173/?story=ch5-maw&profile=POTATO`
- Server ownership: agent-owned Vite preview, session `11920`.
- Extra server started/stopped: one Vite server; stopped after validation.
- Date: 2026-07-19.

## Screenshot Matrix

| View/state | Viewport | Path | Result | Notes |
| --- | --- | --- | --- | --- |
| Mobile closed | 390x844 | `screenshots/final-3/mobile-portrait-closed.png` | Pass | Compact Suit, Journal, Pack, and Systems controls leave the world dominant. |
| Journal | 390x844 | `screenshots/final-3/mobile-portrait-journal.png` | Pass | One-level bottom sheet; touch controls removed and close control focused. |
| Suit expanded | 390x844 | `screenshots/final-3/mobile-portrait-suit-open.png` | Pass | Full telemetry appears temporarily below its trigger without covering Journal. |
| Systems expanded | 390x844 | `screenshots/final-3/mobile-portrait-systems-open.png` | Pass | Build/Fabricator/Pause are grouped in one disclosure; gameplay controls are suppressed. |
| Inventory expanded | 390x844 | `screenshots/final-3/mobile-portrait-inventory-open.png` | Pass | Pack contents are bounded, scrollable, and in viewport. |
| Landscape closed | 844x390 | `screenshots/final-3/mobile-landscape-closed.png` | Pass | Objective marker and complete label route around top HUD chrome. |
| Landscape journal | 844x390 | `screenshots/final-3/mobile-landscape-journal.png` | Pass | Sheet remains legible and safe-area bounded on a short viewport. |
| Narrow closed | 320x568 | `screenshots/final-3/mobile-320x568-closed.png` | Pass | Journal becomes icon-only with an accessible name; control regions retain a 10px gap. |
| Narrow stress | 320x568 | `screenshots/final-3/mobile-320x568-journal-stress.png` | Pass | Sheet stays inside the viewport and scrolls. |
| Desktop regression | 1440x900 | `screenshots/final-3/desktop-card-preserved.png` | Pass | Full desktop objective card and direct utility controls are preserved. |

## Interaction Evidence

- Flow: load `ch5-maw`; inspect closed state; open/close Journal; open Suit then Systems to test mutual exclusion; dismiss Systems; open Inventory; rotate to landscape; resize to 320x568; open stress Journal; load desktop context.
- Result: all ten captures completed with no browser/page errors.
- Automated assertions: Journal focus and containment pass; touch controls disappear under every disclosure; Inventory trigger is 44px; landscape marker does not intersect HUD; narrow joystick/action regions have a 10px gap; desktop keeps the full card.
- Baseline comparison: the persistent mobile objective changed from approximately `354x103` to a `92x44` Journal trigger, while the `216x136` vitals wall became a compact `136x46` Suit summary.
- Report: `screenshots/final-3/mobile-hud-report.json`.

## Screenshot Quality Questions

| View/state | Appealing | Purpose clear | Meaningful | Space used well | Brand-consistent | Goal-effective | Copy ready | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mobile closed | Yes | Yes | Yes | Yes | Yes | Yes | Yes | None |
| Journal | Yes | Yes | Yes | Yes | Yes | Yes | Yes | None |
| Suit/Systems/Inventory | Yes | Yes | Yes | Yes | Yes | Yes | Yes | None |
| Landscape | Yes | Yes | Yes | Yes | Yes | Yes | Yes | None |
| Narrow stress | Yes | Yes | Yes | Yes | Yes | Yes | Yes | None |
| Desktop | Yes | Yes | Yes | Yes | Yes | Yes | Yes | None |

## Gate

- Desktop/mobile captured: `pass`
- Required states captured: `pass`
- Stress data captured: `pass`
- Every major screenshot passes the quality questions or has concrete follow-up defects: `pass`
