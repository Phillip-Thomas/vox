#!/bin/bash
# Stage 5 BEFORE renders: the four beds + bare/colour hash baselines, shipped tail and pre-tail tap.
cd /home/thomasphillip/Projects/vox/main
E=/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-04-audio-10x/evidence/stage-5
NAMES=bed-sandbox-day,bed-sandbox-night,bed-contrast-A,bed-contrast-B,bare-bed,color-bed
node tools/audio-stage-evidence-probe.mjs $E/before/beds --only $NAMES > $E/before/beds-probe.log 2>&1
echo "shipped exit $?" >> $E/before/beds-probe.log
node tools/audio-stage-evidence-probe.mjs $E/before/beds-pretail --only $NAMES --tap pre-tail > $E/before/beds-pretail-probe.log 2>&1
echo "pretail exit $?" >> $E/before/beds-pretail-probe.log
echo DONE > $E/before/render-before.done
