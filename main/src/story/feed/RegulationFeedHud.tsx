import React, { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { theme } from '../../ui/theme.ts';
import { getItemCount, subscribeInventory } from '../../game/systems/inventorySystem.ts';
import {
  getInteraction,
  getInteractionScope,
  PRIMARY_INTERACTION_PROMPT_DOM_ID,
  subscribeInteraction
} from '../../game/systems/interactionSystem.ts';
import { getMawChargeFraction, subscribeMaw } from '../../game/systems/mawSystem.ts';
import { subscribeProgression } from '../../game/systems/progressionSystem.ts';
import { isTouchDevice } from '../../utils/mobileInput.ts';
import { collectedDebrisCount, getDebrisScattered } from '../debrisSalvage.ts';
import { collectedPodCount, SUPPLY_POD_COUNT } from '../supplyPods.ts';
import { NAV_WAYPOINT_COUNT, reachedNavWaypointCount } from '../navWaypoints.ts';
import { cameraChromeVisualState, getFeedRuntime } from '../feedRuntime.ts';
import { getMiningProgress } from '../../game/systems/miningProgress.ts';
import { getStoryText, getStoryTextVersion, subscribeStoryText } from '../storyText.ts';
import { useStoryState } from '../storyState.ts';
import { CH1_FIXED_TUTORIAL, CH1_QUOTA } from '../storyScript.ts';
import { fixedTutorialProgress } from '../storyDirector.ts';
import {
  getActiveGuidedStoryObjective,
  getGuidedStoryObjectiveHealth,
  getGuidedStoryObjectiveVersion,
  subscribeGuidedStoryObjective
} from '../ux/objectiveDirector.ts';
import {
  readStoryHudSafeAreaInsets,
  solveStoryEdgeLabelPresentation,
  solveStoryFeedLedgerPlacement,
  solveStoryHudLayout
} from '../ux/storyHudLayout.ts';
import { presentInputGlyphs } from '../ux/inputGlyphs.ts';
import { hudSurface } from '../../ui/hudSurfaces.ts';

// --- Regulation Feed HUD ----------------------------------------------------------
//
// The suit's compliance display: corner brackets, a frame counter that is very
// proud of itself, the standing work order, the quota ledger, and (Ch2) the
// redaction box. Structure renders via small store subscriptions; the per-frame
// bits (counter, garble, redaction transform) are rAF ref-mutations.

/**
 * The top-right REC / FRM / SITE CAM block's own width cap, and the total
 * horizontal band the standing work order must leave for it: the block's right
 * offset (56) plus its width plus a gutter. Reserving only the WIDTH is the
 * mistake that left 29px of overlap after the first repair — the block is
 * right-anchored, so its left edge sits `56 + width` in from the right.
 */
const FEED_STATUS_WIDTH_PX = 146;
/**
 * Vertical allowance for the tallest ch1 ledger (a label plus two data rows at
 * 10/12/11px on 1.9 line-height, measured at 80px on ch1-iso).
 */
const FEED_LEDGER_HEIGHT_ALLOWANCE_PX = 96;
const FEED_STATUS_LANE_PX = 56 + FEED_STATUS_WIDTH_PX + 12;

const FEED_INK = 'rgba(228,236,231,0.92)';
const FEED_INK_DIM = 'rgba(228,236,231,0.55)';

const GARBLE_CHARS = '█▓▒░#%@&';

/** The camera-switch fiction's tag: fixed-screen cells ARE site cameras, so
 *  the id derives from the cell index (bank 04, lettered around the site). */
function siteCamLabel(cell: number): string {
  return `SITE CAM 04-${String.fromCharCode(65 + (((cell % 26) + 26) % 26))}`;
}

function garbleText(text: string, amount: number): string {
  if (amount <= 0.01) return text;
  let out = '';
  for (const ch of text) {
    out += ch !== ' ' && Math.random() < amount * 0.6
      ? GARBLE_CHARS[Math.floor(Math.random() * GARBLE_CHARS.length)]
      : ch;
  }
  return out;
}

const bracket = (pos: React.CSSProperties): React.CSSProperties => ({
  position: 'fixed',
  width: 26,
  height: 26,
  pointerEvents: 'none',
  ...pos
});

export interface RegulationFeedHudProps {
  /** First-person guidance owns the standing objective and shared marker. */
  embodiedGuidanceActive?: boolean;
}

const RegulationFeedHud: React.FC<RegulationFeedHudProps> = ({
  embodiedGuidanceActive = false
}) => {
  const story = useStoryState();
  useSyncExternalStore(subscribeStoryText, getStoryTextVersion, getStoryTextVersion);
  useSyncExternalStore(
    subscribeGuidedStoryObjective,
    getGuidedStoryObjectiveVersion,
    getGuidedStoryObjectiveVersion
  );
  const text = getStoryText();
  const objective = getActiveGuidedStoryObjective();
  const objectiveHealth = getGuidedStoryObjectiveHealth();
  const inventoryTick = useSyncExternalStore(subscribeInventory, inventoryVersion, inventoryVersion);
  void inventoryTick;
  const interaction = useSyncExternalStore(subscribeInteraction, getInteraction, getInteraction);
  const mawFraction = useSyncExternalStore(subscribeMaw, getMawChargeFraction, getMawChargeFraction);
  useSyncExternalStore(subscribeProgression, progressionVersion, progressionVersion);

  const counterRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<HTMLDivElement>(null);
  const cameraFrameRef = useRef<HTMLDivElement>(null);
  const cameraStatusRef = useRef<HTMLDivElement>(null);
  const cameraReticleRef = useRef<HTMLDivElement>(null);
  const embodiedReticleRef = useRef<HTMLDivElement>(null);
  const harvestRef = useRef<HTMLDivElement>(null);
  const redactionRef = useRef<HTMLDivElement>(null);
  const redactionLabelRef = useRef<HTMLDivElement>(null);
  const redactionIndicatorRef = useRef<HTMLDivElement>(null);
  const redactionIndicatorChevronRef = useRef<HTMLDivElement>(null);
  const redactionIndicatorLabelRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const markerChevronRef = useRef<HTMLDivElement>(null);
  const markerLabelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    let raf = 0;
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    let safeAreaInsets = readStoryHudSafeAreaInsets();
    const currentHudLayout = () => {
      if (viewportWidth !== window.innerWidth || viewportHeight !== window.innerHeight) {
        viewportWidth = window.innerWidth;
        viewportHeight = window.innerHeight;
        safeAreaInsets = readStoryHudSafeAreaInsets();
      }
      return solveStoryHudLayout({
        viewportWidth,
        viewportHeight,
        touch: isTouchDevice(),
        objectivePresent: false,
        safeAreaInsets
      });
    };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const r = getFeedRuntime();
      const cameraChrome = cameraChromeVisualState(r);
      const cameraDisplay = cameraChrome.visible ? 'block' : 'none';
      for (const node of [cameraFrameRef.current, cameraStatusRef.current, cameraReticleRef.current]) {
        if (!node) continue;
        node.style.display = cameraDisplay;
        node.style.opacity = String(cameraChrome.opacity);
      }
      const embodiedReticle = embodiedReticleRef.current;
      if (embodiedReticle) {
        const embodiedOpacity = 1 - cameraChrome.opacity;
        embodiedReticle.style.display = embodiedOpacity >= 0.01 ? 'block' : 'none';
        embodiedReticle.style.opacity = String(embodiedOpacity);
      }
      const counter = counterRef.current;
      if (counter) {
        const stamp = `FRM ${String(r.frame).padStart(7, '0')}`;
        counter.textContent = garbleText(stamp, r.garble);
      }
      // SITE CAM tag (ch1-fixed only): the id follows the cell the worker
      // stands in — each screen flip reads as a coverage hand-off.
      const cam = camRef.current;
      if (cam) cam.textContent = garbleText(siteCamLabel(r.camCell), r.garble);
      // Hold-to-harvest readout (the sandbox crosshair ring is hidden in the feed):
      // a flat ledger percentage — extraction as data entry.
      const harvest = harvestRef.current;
      if (harvest) {
        const mining = getMiningProgress();
        if (mining.active) {
          harvest.style.display = 'block';
          harvest.textContent = mining.blocked
            ? 'TOOL CLASS INSUFFICIENT'
            : `EXTRACTING ${String(Math.round(mining.pct * 100)).padStart(2, '0')}%`;
        } else {
          harvest.style.display = 'none';
        }
      }
      // Survey marker: bracket in frame / edge chevron out of frame.
      const marker = markerRef.current;
      const chevron = markerChevronRef.current;
      const markerLabel = markerLabelRef.current;
      if (marker && chevron && markerLabel) {
        const m = r.marker;
        if (!embodiedGuidanceActive && m.visible && r.treatment > 0.05) {
          marker.style.display = 'flex';
          marker.style.transform = `translate(${m.x}px, ${m.y}px) translate(-50%, -50%)`;
          marker.style.borderStyle = m.offscreen ? 'none' : 'solid';
          chevron.style.display = m.offscreen ? 'block' : 'none';
          chevron.style.transform = `rotate(${m.angle}rad)`;
          markerLabel.textContent = m.label;
        } else {
          marker.style.display = 'none';
        }
      }

      const box = redactionRef.current;
      const label = redactionLabelRef.current;
      if (box && label) {
        const red = r.redaction;
        if (red.visible && r.treatment > 0.05) {
          const jx = (Math.random() - 0.5) * 6 * red.stress;
          const jy = (Math.random() - 0.5) * 6 * red.stress;
          box.style.display = 'flex';
          box.style.transform = `translate(${red.x + jx}px, ${red.y + jy}px)`;
          box.style.width = `${red.w}px`;
          box.style.height = `${red.h}px`;
          label.textContent = garbleText(red.label, red.stress * 0.4);
        } else {
          box.style.display = 'none';
        }
      }

      // A censored subject does not cease to exist when the wearer looks away:
      // replace its box with a separate edge direction (never the objective id).
      const redactionIndicator = redactionIndicatorRef.current;
      const redactionChevron = redactionIndicatorChevronRef.current;
      const redactionIndicatorLabel = redactionIndicatorLabelRef.current;
      if (redactionIndicator && redactionChevron && redactionIndicatorLabel) {
        const indicator = r.redactionIndicator;
        if (indicator.visible && r.treatment > 0.05) {
          redactionIndicator.style.display = 'flex';
          redactionIndicator.style.transform = `translate(${indicator.x}px, ${indicator.y}px) translate(-50%, -50%)`;
          redactionChevron.style.transform = `rotate(${indicator.angle}rad)`;
          redactionIndicatorLabel.textContent = indicator.label;
          const layout = currentHudLayout();
          redactionIndicatorLabel.style.maxWidth = `${layout.marker.labelMaxWidth}px`;
          const labelPresentation = solveStoryEdgeLabelPresentation({
            anchorX: indicator.x,
            labelWidth: redactionIndicatorLabel.getBoundingClientRect().width,
            layout
          });
          // Use relative layout offset instead of a nested transform. Chromium's
          // transformed-parent geometry can report the unshifted child bounds,
          // which makes collision tooling disagree with the pixels on screen.
          redactionIndicatorLabel.style.left = `${labelPresentation.labelOffsetX}px`;
        } else {
          redactionIndicator.style.display = 'none';
        }
      }
    };
    // Ownership may already be embodied on a direct beat link. Mutate the
    // chrome before first paint so REC/SITE framing cannot flash for one frame.
    tick();
    return () => cancelAnimationFrame(raf);
  }, [embodiedGuidanceActive]);

  // The anomaly beat used to keep the already-complete quota ledger in the
  // bottom-left corner. Once the embodied objective card owns that space the
  // historical ledger must yield with the old objective presentation.
  const quotaVisible = !embodiedGuidanceActive
    && (story.beat === 'ch1-raster' || story.beat === 'ch1-anomaly');
  const fixedVisible = story.beat === 'ch1-fixed';
  const trackVisible = story.beat === 'ch1-track';
  const podsVisible = story.beat === 'ch1-depth';
  const navVisible = story.beat === 'ch1-nav';
  const isoVisible = story.beat === 'ch1-iso';
  const fiber = Math.min(getItemCount('biofiber'), CH1_QUOTA.biofiber);
  const stone = Math.min(getItemCount('stone'), CH1_QUOTA.stone);
  const fixedProgress = fixedVisible ? fixedTutorialProgress() : null;
  // Feed-era prompts name the d-pad arrows / EXTRACT / JUMP controls on touch;
  // on desktop the authored keyboard tokens pass through unchanged. The survey
  // chart is not openable during the feed era (the [M] on the ch1-nav retained-
  // tool line is desktop keycap flavor), so it is never actionized on touch.
  const touch = isTouchDevice();
  const feedLine = (line: string): string =>
    presentInputGlyphs(line, touch, 'feed', { chartActionable: false });
  // The ch1 ledgers are the chapter's only honest progress readout, so they
  // must never hide behind the touch controls the player is pressing.
  const ledgerPlacement = solveStoryFeedLedgerPlacement(touch, readStoryHudSafeAreaInsets());

  return (
    <>
      {!embodiedGuidanceActive && text.workorder.length > 0 && (
        <aside
          aria-live="polite"
          aria-atomic="true"
          aria-label="Current story objective"
          data-objective-id={objective?.id}
      {...hudSurface('feed-work-order', 'informational')}
          data-objective-marker-label={objective?.markerLabel}
          data-objective-health={objective ? objectiveHealth : 'idle'}
          data-objective-requires-marker={objective
            ? String(objective.requiresMarker ?? true)
            : undefined}
          style={{
            position: 'fixed',
            // Landscape notches clip a literal inset; every other story HUD
            // surface already respects the safe area.
            top: 'calc(26px + env(safe-area-inset-top, 0px))',
            left: 'calc(56px + env(safe-area-inset-left, 0px))',
            zIndex: theme.z.hud + 2,
            pointerEvents: 'none',
            fontFamily: theme.font.mono,
            color: FEED_INK,
            letterSpacing: '0.1em',
            fontSize: 11,
            lineHeight: 1.75,
            // Reserve the right-hand lane the REC / FRM / SITE CAM block owns.
            // A flat `maxWidth: 460` is inert on a 390px phone, so the order
            // simply wrapped under the status block and the two drew over each
            // other (the HUD overlap sweep measured 131x79px on ch1-fixed).
            maxWidth: `min(460px, calc(100vw - 56px - ${FEED_STATUS_LANE_PX}px`
              + ' - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)))',
            // A narrower column is a TALLER column: on a 320px phone the order
            // wrapped far enough down to reach first the D-pad and then the
            // ledger above it. Bound it by whatever is actually stacked in the
            // bottom-left lane — the ledger placement already clears the pad —
            // and let the tail clip rather than let the directive sit under
            // either. (Both regressions were found by the HUD overlap sweep,
            // the second one caused by fixing the first.)
            maxHeight: `calc(100vh - 26px - ${ledgerPlacement.bottom + FEED_LEDGER_HEIGHT_ALLOWANCE_PX}px`
              + ' - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
            overflow: 'hidden'
          }}
        >
          <div style={{ color: FEED_INK_DIM, marginBottom: 6 }}>
            CONSOLIDATED EXTRACTION AUTHORITY · SUIT FEED
          </div>
          {text.workorder.map((line, i) => (
            <div key={`${i}-${line}`}>{feedLine(line)}</div>
          ))}
        </aside>
      )}

      <div
        aria-hidden
        data-regulation-feed-chrome="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: theme.z.hud + 2,
          pointerEvents: 'none',
          fontFamily: theme.font.mono,
          color: FEED_INK,
          letterSpacing: '0.1em'
        }}
      >
      {/* External-camera framing dissolves as the lift enters the body. */}
      <div ref={cameraFrameRef} style={{ position: 'fixed', inset: 0, display: 'none', opacity: 0 }}>
        <div style={bracket({ top: 16, left: 16, borderTop: `2px solid ${FEED_INK_DIM}`, borderLeft: `2px solid ${FEED_INK_DIM}` })} />
        <div style={bracket({ top: 16, right: 16, borderTop: `2px solid ${FEED_INK_DIM}`, borderRight: `2px solid ${FEED_INK_DIM}` })} />
        <div style={bracket({ bottom: 16, left: 16, borderBottom: `2px solid ${FEED_INK_DIM}`, borderLeft: `2px solid ${FEED_INK_DIM}` })} />
        <div style={bracket({ bottom: 16, right: 16, borderBottom: `2px solid ${FEED_INK_DIM}`, borderRight: `2px solid ${FEED_INK_DIM}` })} />
      </div>

      {/* REC + frame counter */}
      <div
        ref={cameraStatusRef}
        {...hudSurface('feed-camera-status', 'informational')}
        style={{
          position: 'fixed',
          top: 'calc(26px + env(safe-area-inset-top, 0px))',
          right: 'calc(56px + env(safe-area-inset-right, 0px))',
          textAlign: 'right', fontSize: 11, lineHeight: 1.8, display: 'none', opacity: 0,
          maxWidth: FEED_STATUS_WIDTH_PX
        }}
      >
        <div>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: FEED_INK, marginRight: 8,
            animation: 'pvFeedRec 1.6s steps(2, jump-none) infinite'
          }} />
          REC
        </div>
        <div ref={counterRef}>FRM 0000000</div>
        {/* camera-switch chrome: live cam id while coverage is cellular; the
            same camera, impossibly HOLDING, while the hand-off is suspended */}
        {fixedVisible && <div ref={camRef}>{siteCamLabel(getFeedRuntime().camCell)}</div>}
        {trackVisible && <div>{siteCamLabel(getFeedRuntime().camCell)} · HOLDING</div>}
        <div style={{ color: FEED_INK_DIM }}>SITE 7C-θ · LIVE</div>
      </div>

      {/* violation flood (A2 opening) */}
      {text.violation.length > 0 && (
        <div style={{
          position: 'fixed', right: 56, bottom: 30, textAlign: 'right',
          fontSize: 12, lineHeight: 1.9, color: '#ffd28a'
        }}>
          {text.violation.map((line, i) => (
            <div key={`${i}-${line}`} style={{ opacity: 0.45 + (0.55 * (i + 1)) / text.violation.length }}>
              {line}
            </div>
          ))}
        </div>
      )}

      {/* fixed-screen calibration ledger */}
      {fixedProgress && (
        <div {...hudSurface('feed-ledger', 'informational')} style={{ position: 'fixed', ...ledgerPlacement, fontSize: 12, lineHeight: 1.9 }}>
          <div style={{ color: FEED_INK_DIM, fontSize: 10 }}>CALIBRATION</div>
          <div>
            FIBER {fixedProgress.fiber}/{CH1_FIXED_TUTORIAL.biofiber} · SCREENS {fixedProgress.screens}/{CH1_FIXED_TUTORIAL.screens}
          </div>
          <div style={{ color: FEED_INK_DIM, fontSize: 11 }}>
            HARVESTER CELL {Math.round(mawFraction * 100)}% · TRICKLE FEED
          </div>
        </div>
      )}

      {/* supply-pod recovery ledger */}
      {podsVisible && (
        <div {...hudSurface('feed-ledger', 'informational')} style={{ position: 'fixed', ...ledgerPlacement, fontSize: 12, lineHeight: 1.9 }}>
          <div style={{ color: FEED_INK_DIM, fontSize: 10 }}>RECOVERY</div>
          <div>SUPPLY PODS {collectedPodCount()}/{SUPPLY_POD_COUNT}</div>
          <div style={{ color: FEED_INK_DIM, fontSize: 11 }}>
            {feedLine('WORK LINE LOCKED · [A]/[D]')}
          </div>
        </div>
      )}

      {/* nav-view grid: the world as a chart (top-down era only) */}
      {navVisible && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(228,236,231,0.07) 0 1px, transparent 1px 64px),'
              + ' repeating-linear-gradient(90deg, rgba(228,236,231,0.07) 0 1px, transparent 1px 64px)',
            pointerEvents: 'none'
          }}
        />
      )}
      {navVisible && (
        <div style={{ position: 'fixed', top: 26, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: FEED_INK_DIM, letterSpacing: '0.3em' }}>
          — NAV VIEW · GRID 64 —
        </div>
      )}

      {/* triangulation ledger */}
      {navVisible && (
        <div {...hudSurface('feed-ledger', 'informational')} style={{ position: 'fixed', ...ledgerPlacement, fontSize: 12, lineHeight: 1.9 }}>
          <div style={{ color: FEED_INK_DIM, fontSize: 10 }}>TRIANGULATION</div>
          <div>FIXES {reachedNavWaypointCount()}/{NAV_WAYPOINT_COUNT}</div>
          <div style={{ color: FEED_INK_DIM, fontSize: 11 }}>NAV VIEW · FOLLOW THE MARKER</div>
        </div>
      )}

      {/* elevation ledger */}
      {isoVisible && (
        <div {...hudSurface('feed-ledger', 'informational')} style={{ position: 'fixed', ...ledgerPlacement, fontSize: 12, lineHeight: 1.9 }}>
          <div style={{ color: FEED_INK_DIM, fontSize: 10 }}>ELEVATION</div>
          <div>REACH THE SIGNAL SOURCE</div>
          <div style={{ color: FEED_INK_DIM, fontSize: 11 }}>{feedLine('ASCEND [SPACE] · THE STAIRS FACE THE STRIP')}</div>
        </div>
      )}

      {/* quota ledger */}
      {quotaVisible && (
        <div {...hudSurface('feed-ledger', 'informational')} style={{ position: 'fixed', ...ledgerPlacement, fontSize: 12, lineHeight: 1.9 }}>
          <div style={{ color: FEED_INK_DIM, fontSize: 10 }}>QUOTA</div>
          <div>
            FIBER {fiber}/{CH1_QUOTA.biofiber} · STONE {stone}/{CH1_QUOTA.stone} · DEBRIS {collectedDebrisCount()}/{getDebrisScattered()}
          </div>
          <div style={{ color: FEED_INK_DIM, fontSize: 11 }}>
            HARVESTER CELL {Math.round(mawFraction * 100)}% · TRICKLE FEED
          </div>
        </div>
      )}

      {/* Camera reticle becomes a quiet embodied aiming point at handoff. */}
      <div ref={cameraReticleRef} style={{
        position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        fontSize: 16, color: FEED_INK_DIM, display: 'none', opacity: 0
      }}>
        +
      </div>
      <div ref={embodiedReticleRef} style={{
        position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 3, height: 3, borderRadius: '50%', background: FEED_INK_DIM,
        display: 'none', opacity: 0
      }} />

      {/* hold-to-harvest readout */}
      <div
        ref={harvestRef}
        style={{
          position: 'fixed', left: '50%', top: '56%', transform: 'translateX(-50%)',
          display: 'none', fontSize: 11, letterSpacing: '0.24em', color: FEED_INK
        }}
      />

      {/* context interaction (the sandbox prompt is hidden during the feed) */}
      {interaction && (
        <div
          id={PRIMARY_INTERACTION_PROMPT_DOM_ID}
          data-interaction-prompt="primary"
      {...hudSurface('feed-interaction-prompt', 'informational')}
          data-interaction-id={interaction.id}
          data-interaction-owner="regulation-feed"
          data-interaction-scope={getInteractionScope(interaction.id)}
          aria-label={`Interaction: ${interaction.verb}`}
          style={{
            position: 'fixed', left: '50%', bottom: '18%', transform: 'translateX(-50%)',
            fontSize: 12, letterSpacing: '0.2em',
            border: `1px solid ${FEED_INK_DIM}`, padding: '7px 14px',
            background: 'rgba(2,4,3,0.55)'
          }}
        >
          {feedLine(`[F] ${interaction.verb.toUpperCase()}`)}
        </div>
      )}

      {/* survey marker (ch1 objective designator, driver-projected). It leaves
          the DOM at embodiment so FreeMarker is the only objective marker. */}
      {!embodiedGuidanceActive && (
        <div
          ref={markerRef}
          className="pv-regulation-objective-marker"
          data-regulation-objective-marker="true"
      {...hudSurface('feed-objective-marker', 'marker')}
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            display: 'none',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            width: 54,
            height: 54,
            justifyContent: 'center',
            border: `1px dashed ${FEED_INK_DIM}`,
            willChange: 'transform',
            animation: 'pvFeedRec 1.6s steps(2, jump-none) infinite'
          }}
        >
          <div ref={markerChevronRef} style={{ display: 'none', fontSize: 24, color: FEED_INK, textShadow: '0 0 6px rgba(0,0,0,0.9)' }}>▶</div>
          <div ref={markerLabelRef} style={{
            fontSize: 10, letterSpacing: '0.14em', whiteSpace: 'nowrap', color: FEED_INK,
            background: 'rgba(2,4,3,0.66)', padding: '3px 7px'
          }} />
        </div>
      )}

      {/* redaction box (driven by the driver's screen-space projection) */}
      <div
        ref={redactionRef}
        data-redaction-box="true"
      {...hudSurface('feed-redaction-box', 'marker')}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(2,4,3,0.96)',
          border: '2px solid rgba(228,236,231,0.85)',
          outline: '2px dashed rgba(228,236,231,0.35)',
          outlineOffset: 3,
          willChange: 'transform'
        }}
      >
        <div ref={redactionLabelRef} style={{ fontSize: 10, letterSpacing: '0.16em', padding: 10, textAlign: 'center' }} />
      </div>

      {/* Off-view censored subject: a directional warning, intentionally distinct
          from the work-order/objective bracket. */}
      <div
        ref={redactionIndicatorRef}
        data-redaction-indicator="true"
      {...hudSurface('feed-redaction-indicator', 'marker')}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          display: 'none',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 5,
          color: 'rgba(255,210,138,0.92)',
          willChange: 'transform',
          filter: 'drop-shadow(0 1px 5px rgba(0,0,0,0.9))'
        }}
      >
        <div
          ref={redactionIndicatorChevronRef}
          style={{
            fontSize: 22,
            lineHeight: 1,
            transformOrigin: '50% 50%',
            borderLeft: '4px solid rgba(2,4,3,0.92)',
            paddingLeft: 2
          }}
        >
          ▶
        </div>
        <div
          ref={redactionIndicatorLabelRef}
          style={{
            fontSize: 9,
            letterSpacing: '0.16em',
            lineHeight: 1.35,
            position: 'relative',
            maxWidth: 'min(240px, calc(100vw - 36px))',
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
            textAlign: 'center',
            boxSizing: 'border-box',
            color: 'rgba(255,210,138,0.92)',
            background: 'rgba(2,4,3,0.82)',
            border: '1px solid rgba(255,210,138,0.45)',
            padding: '3px 7px'
          }}
        />
      </div>

      <style>{`
        @keyframes pvFeedRec {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0.15; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pv-regulation-objective-marker {
            animation: none !important;
          }
        }
      `}</style>
      </div>
    </>
  );
};

// Inventory subscription just needs a changing token; counts are re-read in render.
let invVersion = 0;
subscribeInventory(() => { invVersion++; });
function inventoryVersion(): number {
  return invVersion;
}
// Same trick for progression (debris salvage lives in milestones).
let progVersion = 0;
subscribeProgression(() => { progVersion++; });
function progressionVersion(): number {
  return progVersion;
}

export default RegulationFeedHud;
