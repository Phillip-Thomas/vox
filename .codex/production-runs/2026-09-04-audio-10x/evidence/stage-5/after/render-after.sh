#!/bin/bash
cd /home/thomasphillip/Projects/vox/main
E=/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-04-audio-10x/evidence/stage-5
NAMES=bed-sandbox-day,bed-sandbox-night,bed-contrast-A,bed-contrast-B,bare-bed,color-bed
rm -rf $E/after/beds/* $E/after/beds-pretail/*
node tools/audio-stage-evidence-probe.mjs $E/after/beds --only $NAMES > $E/after/beds-probe.log 2>&1
echo "shipped exit $?" >> $E/after/beds-probe.log
node tools/audio-stage-evidence-probe.mjs $E/after/beds-pretail --only $NAMES --tap pre-tail > $E/after/beds-pretail-probe.log 2>&1
echo "pretail exit $?" >> $E/after/beds-pretail-probe.log
echo DONE > $E/after/render-after.done
