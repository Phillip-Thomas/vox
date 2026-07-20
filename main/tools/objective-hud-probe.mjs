import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.PARAVOXIA_URL ?? 'http://127.0.0.1:5173/';
const chromePath = process.env.CHROME_PATH ?? '/snap/bin/chromium';
const graphicsProfile = process.env.PARAVOXIA_OBJECTIVE_GRAPHICS_PROFILE ?? 'POTATO';
const outputDir = path.resolve(
  process.env.PARAVOXIA_OBJECTIVE_OUTPUT ?? 'captures/objective-hud'
);
const cases = (process.env.PARAVOXIA_OBJECTIVE_CASES
  ?? 'ch1-anomaly,ch2-approach,ch3-gather,ch4-audit,ch5-maw,ch6-dive,ch7-reconstruct,ch8-crossing,ch9-settle,ch9-hearth')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);
const requestedProfiles = new Set((process.env.PARAVOXIA_OBJECTIVE_PROFILES ?? 'desktop,mobile')
  .split(',')
  .map(value => value.trim().toLowerCase())
  .filter(Boolean));
const profiles = [
  {
    id: 'desktop',
    viewport: { width: 1440, height: 900 },
    hasTouch: false,
    isMobile: false,
    reducedMotion: 'no-preference'
  },
  {
    id: 'mobile',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce'
  }
].filter(profile => requestedProfiles.has(profile.id));

if (profiles.length === 0) throw new Error('No valid objective HUD probe profile selected.');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--enable-unsafe-swiftshader'
  ]
});

const results = [];
try {
  for (const profile of profiles) {
    for (const beat of cases) {
      const context = await browser.newContext({
        viewport: profile.viewport,
        hasTouch: profile.hasTouch,
        isMobile: profile.isMobile,
        reducedMotion: profile.reducedMotion
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
      page.on('console', message => {
        if (message.type() === 'error') errors.push(`console: ${message.text()}`);
      });

      const url = new URL(baseUrl);
      url.searchParams.set('story', beat);
      url.searchParams.set('debug', '1');
      // HUD geometry and ownership do not depend on expensive world detail.
      // Force a deterministic low-cost render so headless software WebGL can
      // reach the same scene-ready boundary that publishes world-space anchors.
      url.searchParams.set('profile', graphicsProfile);
      const startedAt = Date.now();
      let entryAt = null;
      let objectiveFirstSeenMs = null;
      let evidence = null;
      let screenshot = null;
      let failure = null;

      try {
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForFunction(() => {
          if (window.__paravoxiaAppState?.phase === 'playing') return true;
          return [...document.querySelectorAll('button')].some(button => (
            button.textContent?.includes('Play Now') && !button.disabled
          ));
        }, undefined, { timeout: 60_000 });

        const alreadyPlaying = await page.evaluate(
          () => window.__paravoxiaAppState?.phase === 'playing'
        );
        if (!alreadyPlaying) {
          await page.getByRole('button', { name: /Play Now/i }).click({ force: true });
        }
        entryAt = Date.now();
        await page.waitForFunction(expectedBeat => (
          window.__paravoxiaAppState?.phase === 'playing'
          && window.__storyBeat === expectedBeat
          && document.querySelector('canvas') instanceof HTMLCanvasElement
        ), beat, { timeout: 45_000 });
        await page.waitForSelector('[aria-label="Current story objective"]', {
          state: 'visible',
          timeout: 5_000
        });
        objectiveFirstSeenMs = Date.now() - entryAt;

        // Required markers may wait for the relevant world prop/body publisher,
        // but the card itself must already be present while that scene prepares.
        await page.waitForFunction(() => {
          const card = document.querySelector('[aria-label="Current story objective"]');
          if (!(card instanceof HTMLElement)) return false;
          return card.dataset.objectiveRequiresMarker !== 'true'
            || card.dataset.objectiveHealth === 'ready';
        }, undefined, { timeout: 45_000 }).catch(() => undefined);
        // Marker health can publish before its DOM presentation has sampled
        // mobile chrome. A required objective is not ready for evidence until
        // one of its actual guidance owners is visibly presented.
        await page.waitForFunction(() => {
          const card = document.querySelector('[aria-label="Current story objective"]');
          if (!(card instanceof HTMLElement)) return false;
          if (card.dataset.objectiveRequiresMarker !== 'true'
            || card.dataset.objectiveHealth !== 'ready') return true;

          const visibleRect = element => {
            if (!(element instanceof HTMLElement)) return null;
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            return style.display !== 'none'
              && style.visibility !== 'hidden'
              && style.visibility !== 'collapse'
              && Number(style.opacity || 1) > 0
              && box.width > 0
              && box.height > 0
              ? box
              : null;
          };

          const redactionBox = document.querySelector('[data-redaction-box="true"]');
          if (visibleRect(redactionBox)) return true;

          const redaction = document.querySelector('[data-redaction-indicator="true"]');
          if (visibleRect(redaction)) {
            const label = redaction.lastElementChild;
            const labelRect = visibleRect(label);
            return Boolean(labelRect && labelRect.left >= 0 && labelRect.right <= innerWidth);
          }

          const marker = document.querySelector('[data-story-free-marker="true"]');
          const markerRect = visibleRect(marker);
          if (marker instanceof HTMLElement && markerRect) {
            return marker.dataset.markerLayout === 'ready'
              && Boolean(marker.dataset.motionPresentation)
              && (Math.abs(markerRect.left) > 0.5 || Math.abs(markerRect.top) > 0.5);
          }

          return false;
        }, undefined, { timeout: 45_000 }).catch(() => undefined);
        await page.waitForTimeout(250);

        evidence = await page.evaluate(() => {
          const rect = element => {
            if (!(element instanceof HTMLElement)) return null;
            const box = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
              right: box.right,
              bottom: box.bottom,
              visible: style.display !== 'none'
                && style.visibility !== 'hidden'
                && style.visibility !== 'collapse'
                && Number(style.opacity || 1) > 0
                && box.width > 0
                && box.height > 0
            };
          };
          const intersects = (a, b) => Boolean(
            a?.visible && b?.visible
            && a.x < b.right && a.right > b.x
            && a.y < b.bottom && a.bottom > b.y
          );
          const cards = [...document.querySelectorAll('[aria-label="Current story objective"]')];
          const card = cards[0] instanceof HTMLElement ? cards[0] : null;
          const cardRect = rect(card);
          const captionRect = rect(document.querySelector('[data-story-caption="true"]'));
          const marker = document.querySelector('[data-story-free-marker="true"]');
          const redaction = document.querySelector('[data-redaction-indicator="true"]');
          const redactionBox = document.querySelector('[data-redaction-box="true"]');
          const markerChildren = marker instanceof HTMLElement ? [...marker.children] : [];
          const redactionChildren = redaction instanceof HTMLElement ? [...redaction.children] : [];
          const legacyMarkers = [...document.querySelectorAll('[data-regulation-objective-marker="true"]')];
          const joystickRect = rect(document.querySelector('[data-testid="touch-joystick"]'));
          const actionRect = rect(document.querySelector('[data-testid="touch-action-cluster"]'));
          const vitalsRect = rect(document.querySelector('[data-testid="vitals-meter"]'));
          const inventoryRect = rect(document.querySelector('[data-testid="inventory-panel"]'));
          const quickActionsRect = rect(document.querySelector('[aria-label="HUD quick actions"]'));
          const markerRect = rect(marker);
          const markerLabelRect = rect(markerChildren.at(-1));
          const redactionRect = rect(redaction);
          const redactionLabelRect = rect(redactionChildren.at(-1));
          const redactionBoxRect = rect(redactionBox);
          const freeMarkerVisible = Boolean(
            markerRect?.visible
            && marker instanceof HTMLElement
            && marker.dataset.markerLayout === 'ready'
          );
          const redactionIndicatorVisible = Boolean(
            redactionRect?.visible && redactionLabelRect?.visible
          );
          const redactionBoxVisible = Boolean(redactionBoxRect?.visible);
          const insideViewport = box => Boolean(
            box
            && box.x >= 0
            && box.y >= 0
            && box.right <= innerWidth
            && box.bottom <= innerHeight
          );
          return {
            beat: window.__storyBeat ?? null,
            app: window.__paravoxiaAppState ?? null,
            viewport: { width: innerWidth, height: innerHeight },
            objectiveCount: cards.length,
            objective: card ? {
              id: card.dataset.objectiveId ?? null,
              markerLabel: card.dataset.objectiveMarkerLabel ?? null,
              health: card.dataset.objectiveHealth ?? null,
              requiresMarker: card.dataset.objectiveRequiresMarker ?? null,
              text: card.textContent?.trim() ?? '',
              rect: cardRect,
              insideViewport: Boolean(
                cardRect
                && cardRect.x >= 0
                && cardRect.y >= 0
                && cardRect.right <= innerWidth
                && cardRect.bottom <= innerHeight
              )
            } : null,
            caption: {
              rect: captionRect,
              insideViewport: !captionRect?.visible || insideViewport(captionRect),
              intersectsObjective: intersects(captionRect, cardRect)
            },
            marker: {
              count: document.querySelectorAll('[data-story-free-marker="true"]').length,
              rect: markerRect,
              labelRect: markerLabelRect,
              labelInsideViewport: !markerLabelRect?.visible || insideViewport(markerLabelRect),
              intersectsObjective: intersects(markerRect, cardRect)
                || intersects(markerLabelRect, cardRect),
              intersectsCaption: intersects(markerRect, captionRect)
                || intersects(markerLabelRect, captionRect),
              transform: marker instanceof HTMLElement ? marker.style.transform : null,
              computedTransform: marker instanceof HTMLElement ? getComputedStyle(marker).transform : null,
              labelTransform: markerChildren.at(-1) instanceof HTMLElement
                ? markerChildren.at(-1).style.transform
                : null,
              motionPresentation: marker instanceof HTMLElement
                ? marker.dataset.motionPresentation ?? null
                : null,
              layoutState: marker instanceof HTMLElement
                ? marker.dataset.markerLayout ?? null
                : null,
              topLeftOcclusion: marker instanceof HTMLElement
                ? marker.dataset.topLeftOcclusion ?? null
                : null
            },
            redactionIndicator: {
              rect: redactionRect,
              labelRect: redactionLabelRect,
              labelInsideViewport: !redactionLabelRect?.visible || insideViewport(redactionLabelRect),
              intersectsObjective: intersects(redactionRect, cardRect)
                || intersects(redactionLabelRect, cardRect),
              intersectsCaption: intersects(redactionRect, captionRect)
                || intersects(redactionLabelRect, captionRect),
              transform: redaction instanceof HTMLElement ? redaction.style.transform : null,
              labelOffset: redactionChildren.at(-1) instanceof HTMLElement
                ? redactionChildren.at(-1).style.left
                : null,
              labelTransform: redactionChildren.at(-1) instanceof HTMLElement
                ? redactionChildren.at(-1).style.transform
                : null
            },
            redactionBox: {
              rect: redactionBoxRect
            },
            guidance: {
              required: card?.dataset.objectiveRequiresMarker === 'true',
              freeMarkerVisible,
              redactionIndicatorVisible,
              redactionBoxVisible,
              visibleOwner: freeMarkerVisible
                || redactionIndicatorVisible
                || redactionBoxVisible
            },
            legacyMarkerCount: legacyMarkers.length,
            topHud: {
              vitalsRect,
              inventoryRect,
              quickActionsRect,
              markerIntersectsVitals: intersects(markerRect, vitalsRect)
                || intersects(markerLabelRect, vitalsRect),
              markerIntersectsInventory: intersects(markerRect, inventoryRect)
                || intersects(markerLabelRect, inventoryRect),
              markerIntersectsQuickActions: intersects(markerRect, quickActionsRect)
                || intersects(markerLabelRect, quickActionsRect),
              redactionIntersectsVitals: intersects(redactionRect, vitalsRect)
                || intersects(redactionLabelRect, vitalsRect),
              redactionIntersectsInventory: intersects(redactionRect, inventoryRect)
                || intersects(redactionLabelRect, inventoryRect)
            },
            touchControls: {
              joystickRect,
              actionRect,
              objectiveIntersectsJoystick: intersects(cardRect, joystickRect),
              objectiveIntersectsActions: intersects(cardRect, actionRect)
            }
          };
        });

        const failures = [];
        if (evidence.objectiveCount !== 1) {
          failures.push(`expected one objective surface, found ${evidence.objectiveCount}`);
        }
        if (!evidence.objective?.id) failures.push('objective id is missing');
        if (!evidence.objective?.markerLabel) failures.push('objective marker label is missing');
        if (!evidence.objective?.insideViewport) failures.push('objective card leaves the viewport');
        if (!evidence.caption.insideViewport) failures.push('story caption leaves the viewport');
        if (evidence.caption.intersectsObjective) failures.push('story caption intersects objective card');
        if (evidence.objective?.requiresMarker === 'true' && evidence.objective.health !== 'ready') {
          failures.push(`required marker health is ${evidence.objective?.health ?? 'missing'}`);
        }
        if (evidence.objective?.requiresMarker === 'false' && evidence.objective.health !== 'ready') {
          failures.push(`markerless objective health is ${evidence.objective?.health ?? 'missing'}`);
        }
        if (evidence.guidance.required && !evidence.guidance.visibleOwner) {
          failures.push('required objective has no visible guidance owner');
        }
        if (!evidence.marker.labelInsideViewport) failures.push('directional marker label leaves the viewport');
        if (evidence.marker.intersectsObjective) failures.push('directional marker intersects objective card');
        if (evidence.marker.intersectsCaption) failures.push('directional marker intersects story caption');
        if (!evidence.redactionIndicator.labelInsideViewport) {
          failures.push('redaction direction label leaves the viewport');
        }
        if (evidence.redactionIndicator.intersectsObjective) {
          failures.push('redaction direction intersects objective card');
        }
        if (evidence.redactionIndicator.intersectsCaption) {
          failures.push('redaction direction intersects story caption');
        }
        if (evidence.legacyMarkerCount !== 0) failures.push('legacy marker still owns embodied guidance');
        if (evidence.topHud.markerIntersectsVitals) failures.push('directional marker intersects survival vitals');
        if (evidence.topHud.markerIntersectsInventory) failures.push('directional marker intersects inventory');
        if (evidence.topHud.markerIntersectsQuickActions) {
          failures.push('directional marker intersects HUD quick actions');
        }
        if (evidence.topHud.redactionIntersectsVitals) failures.push('redaction direction intersects survival vitals');
        if (evidence.topHud.redactionIntersectsInventory) failures.push('redaction direction intersects inventory');
        if (evidence.touchControls.objectiveIntersectsJoystick) {
          failures.push('objective card intersects the movement joystick');
        }
        if (evidence.touchControls.objectiveIntersectsActions) {
          failures.push('objective card intersects the touch action cluster');
        }
        if (profile.hasTouch && !evidence.touchControls.joystickRect?.visible) {
          failures.push('embodied mobile objective has no movement joystick');
        }
        if (profile.hasTouch && !evidence.touchControls.actionRect?.visible) {
          failures.push('embodied mobile objective has no action controls');
        }
        if (failures.length > 0) failure = failures.join('; ');

        screenshot = path.join(outputDir, `${profile.id}-${beat}.png`);
        await page.screenshot({ path: screenshot, timeout: 60_000, animations: 'disabled' });
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
      }

      const unexpectedErrors = errors.filter(message => !(
        message.includes('AudioContext')
        || message.includes('favicon')
        || message.includes('WebGL') && message.includes('ReadPixels')
      ));
      if (!failure && unexpectedErrors.length > 0) failure = unexpectedErrors.join('; ');
      results.push({
        beat,
        profile: profile.id,
        url: url.toString(),
        elapsedMs: Date.now() - startedAt,
        objectiveFirstSeenMs,
        screenshot,
        evidence,
        errors: unexpectedErrors,
        status: failure ? 'failed' : 'passed',
        failure
      });
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const reportPath = path.join(outputDir, 'objective-hud-report.json');
await writeFile(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  baseUrl,
  graphicsProfile,
  results
}, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ reportPath, results }, null, 2)}\n`);
if (results.some(result => result.status === 'failed')) process.exitCode = 1;
