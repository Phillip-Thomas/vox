# Stage 2 A/B results

Generated 2026-09-05T10:55:45.354Z. Verdict per contracted term; owner audition is separate.

## Loudness table (before → after, combined tail)

| render | s | I before | I after | ΔI | S-max before | S-max after | ΔS | TP before | TP after | ΔTP | LRA after | corr after | smooth |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bed-sandbox-day | 210 | -20.48 | -20.36 | 0.13 | -18.12 (131.1s) | -17.9 (131.1s) | 0.21 | -9.37 | -9.02 | 0.35 | 3.71 | 0.936 | 0→0 |
| bed-sandbox-night | 210 | -20.51 | -20.39 | 0.12 | -18.25 (123.7s) | -18.04 (123.7s) | 0.22 | -8.43 | -8.03 | 0.4 | 3.36 | 0.943 | 0→0 |
| bed-contrast-A | 210 | -20.53 | -20.39 | 0.14 | -16.88 (45s) | -16.59 (45s) | 0.29 | -8.65 | -8.22 | 0.42 | 3.77 | 0.929 | 0→0 |
| bed-contrast-B | 210 | -21.07 | -20.96 | 0.11 | -18.94 (169.6s) | -18.79 (169.7s) | 0.15 | -9.47 | -9.13 | 0.34 | 5.27 | 0.944 | 0→0 |
| story-beat | 90 | -20.18 | -20.09 | 0.08 | -18.28 (53.6s) | -18.12 (53.6s) | 0.16 | -9.64 | -9.31 | 0.32 | 2.49 | 0.875 | 0→0 |
| era-transition | 120 | -22.58 | -22.45 | 0.13 | -18.94 (117s) | -18.78 (117s) | 0.16 | -9.03 | -8.66 | 0.37 | 15.35 | 0.958 | 12→11 |
| bare-bed | 48 | -34.53 | -34.54 | -0.01 | -34.17 (7.1s) | -34.18 (7.1s) | -0.01 | -25.17 | -25.17 | -0.01 | 0.45 | 1 | 54→54 |
| bare-story-ch1-fixed | 60 | -35.95 | -35.93 | 0.02 | -34.17 (7.1s) | -34.18 (7.1s) | -0.01 | -25.3 | -25.31 | -0.01 | 16.57 | 1 | 54→56 |
| color-bed | 48 | -27.28 | -27.28 | 0 | -26.58 (7.2s) | -26.59 (7.2s) | -0.01 | -19.21 | -19.22 | -0.01 | 1.43 | 1 | 0→0 |
| bed-check | 90 | -20.41 | -20.29 | 0.12 | -18.75 (16s) | -18.59 (16s) | 0.16 | -9.15 | -8.79 | 0.36 | 3.32 | 0.922 | 0→0 |
| combined-check | 90 | -20.4 | -20.37 | 0.03 | -18.75 (16s) | -18.58 (16s) | 0.16 | -9.15 | -8.79 | 0.36 | 3.44 | 0.922 | 0→0 |
| stress-shipcrash-bloom | 210 | -20.48 | -20.39 | 0.1 | -18.11 (131.1s) | -18.08 (145s) | 0.03 | -9.37 | -9.02 | 0.35 | 3.64 | 0.936 | 0→0 |
| stress-mining-burst | 60 | -20.57 | -20.45 | 0.11 | -19 (7.2s) | -18.85 (7.3s) | 0.15 | -4.86 | -4.92 | -0.06 | 3.39 | 0.935 | 2→2 |
| stress-oxygen-dive | 60 | -21.45 | -21.69 | -0.24 | -19.05 (6.7s) | -18.92 (6.8s) | 0.14 | -9.23 | -8.86 | 0.38 | 4.52 | 0.863 | 9→10 |
| stress-terminal-storylead | 60 | -20.39 | -20.38 | 0 | -19.01 (7.1s) | -18.87 (7.2s) | 0.14 | -9.81 | -9.49 | 0.32 | 2.5 | 0.899 | 0→0 |
| stress-jetpack-splash | 60 | -20.74 | -20.67 | 0.07 | -18.99 (7.2s) | -18.84 (7.3s) | 0.15 | -9.8 | -9.53 | 0.28 | 3.16 | 0.925 | 1→0 |
| floor-ch4-defy | 60 | -33.1 | -33.11 | -0.01 | -32.88 (37.9s) | -32.88 (37.9s) | 0 | -24.01 | -24.02 | -0.01 | 0.18 | 0.975 | 0→0 |
| floor-refused | 60 | -26.93 | -26.94 | -0.01 | -26.69 (7.1s) | -26.71 (7.1s) | -0.01 | -14.97 | -14.94 | 0.02 | 0.2 | 0.893 | 0→0 |
| floor-seam-ebb | 60 | -23.2 | -23.19 | 0.01 | -22.88 (53.6s) | -22.87 (53.6s) | 0.01 | -12.49 | -12.38 | 0.11 | 0.32 | 0.906 | 0→0 |

## Terms

| id | term | required | measured | verdict |
|---|---|---|---|---|
| stress.tp.stress-shipcrash-bloom | stress-shipcrash-bloom true peak | <= -1 dBTP | -9.02 dBTP | met |
| stress.lufs.stress-shipcrash-bloom | stress-shipcrash-bloom integrated | -18 ±1.5 LU (see README deviation: bed alone is contracted at -20.5) | -20.39 LUFS | **not met** |
| stress.tp.stress-mining-burst | stress-mining-burst true peak | <= -1 dBTP | -4.92 dBTP | met |
| stress.lufs.stress-mining-burst | stress-mining-burst integrated | -18 ±1.5 LU (see README deviation: bed alone is contracted at -20.5) | -20.45 LUFS | **not met** |
| stress.tp.stress-oxygen-dive | stress-oxygen-dive true peak | <= -1 dBTP | -8.86 dBTP | met |
| stress.lufs.stress-oxygen-dive | stress-oxygen-dive integrated | -18 ±1.5 LU (see README deviation: bed alone is contracted at -20.5) | -21.69 LUFS | **not met** |
| stress.tp.stress-terminal-storylead | stress-terminal-storylead true peak | <= -1 dBTP | -9.49 dBTP | met |
| stress.lufs.stress-terminal-storylead | stress-terminal-storylead integrated | -18 ±1.5 LU (see README deviation: bed alone is contracted at -20.5) | -20.38 LUFS | **not met** |
| stress.tp.stress-jetpack-splash | stress-jetpack-splash true peak | <= -1 dBTP | -9.53 dBTP | met |
| stress.lufs.stress-jetpack-splash | stress-jetpack-splash integrated | -18 ±1.5 LU (see README deviation: bed alone is contracted at -20.5) | -20.67 LUFS | **not met** |
| bloom.smax.bed-sandbox-day | bed-sandbox-day BLOOM short-term max | -14 ±1 LU | -17.9 LUFS at 131.1s | **not met** |
| bloom.smax.stress-shipcrash-bloom | stress-shipcrash-bloom BLOOM short-term max | -14 ±1 LU | -18.08 LUFS at 145s | **not met** |
| bed.alive.bed-sandbox-day | bed-sandbox-day bed alone integrated | -20.5 ±1 LU | -20.36 LUFS | met |
| bed.alive.bed-sandbox-night | bed-sandbox-night bed alone integrated | -20.5 ±1 LU | -20.39 LUFS | met |
| bed.alive.bed-contrast-A | bed-contrast-A bed alone integrated | -20.5 ±1 LU | -20.39 LUFS | met |
| bed.alive.bed-contrast-B | bed-contrast-B bed alone integrated | -20.5 ±1 LU | -20.96 LUFS | met |
| rebaseline.pretail.bare-bed | bare-bed pre-tail tap identical | fingerprint identical and <= 2 LSB | fingerprint identical, max |Δ| 1 LSB (-90.31 dBFS) | met |
| rebaseline.pretail.bare-story-ch1-fixed | bare-story-ch1-fixed pre-tail tap identical | fingerprint identical and <= 2 LSB | fingerprint identical, max |Δ| 1 LSB (-90.31 dBFS) | met |
| rebaseline.pretail.color-bed | color-bed pre-tail tap identical | fingerprint identical and <= 2 LSB | fingerprint identical, max |Δ| 1 LSB (-90.31 dBFS) | met |
| rebaseline.tail.I.bare-bed | bare-bed through-tail integrated | within 0.3 LU | Δ -0.008 LU | met |
| rebaseline.tail.S.bare-bed | bare-bed through-tail short-term (every 3 s window) | within 1 LU | max Δ 0.05 LU at 28s over 46 windows | met |
| rebaseline.tail.TP.bare-bed | bare-bed through-tail true peak | within 0.5 dB | Δ -0.007 dB | met |
| rebaseline.tail.I.bare-story-ch1-fixed | bare-story-ch1-fixed through-tail integrated | within 0.3 LU | Δ 0.016 LU | met |
| rebaseline.tail.S.bare-story-ch1-fixed | bare-story-ch1-fixed through-tail short-term (every 3 s window) | within 1 LU | max Δ 0.09 LU at 26s over 58 windows | met |
| rebaseline.tail.TP.bare-story-ch1-fixed | bare-story-ch1-fixed through-tail true peak | within 0.5 dB | Δ -0.007 dB | met |
| rebaseline.tail.I.color-bed | color-bed through-tail integrated | within 0.3 LU | Δ 0 LU | met |
| rebaseline.tail.S.color-bed | color-bed through-tail short-term (every 3 s window) | within 1 LU | max Δ 0.04 LU at 0s over 46 windows | met |
| rebaseline.tail.TP.color-bed | color-bed through-tail true peak | within 0.5 dB | Δ -0.007 dB | met |
| floor.I.floor-ch4-defy | floor-ch4-defy integrated old vs new tail | within 0.25 LU | Δ -0.008 LU (-33.1 → -33.11) | met |
| floor.S.floor-ch4-defy | floor-ch4-defy short-term after <= before + 0.5 | after <= before + 0.5 LU | -32.88 → -32.88 | met |
| floor.I.floor-refused | floor-refused integrated old vs new tail | within 0.25 LU | Δ -0.008 LU (-26.93 → -26.94) | met |
| floor.S.floor-refused | floor-refused short-term after <= before + 0.5 | after <= before + 0.5 LU | -26.69 → -26.71 | met |
| floor.I.floor-seam-ebb | floor-seam-ebb integrated old vs new tail | within 0.25 LU | Δ 0.01 LU (-23.2 → -23.19) | met |
| floor.S.floor-seam-ebb | floor-seam-ebb short-term after <= before + 0.5 | after <= before + 0.5 LU | -22.88 → -22.87 | met |
| duck.depth.shipCrash | shipCrash music duck depth | -6 ±1 dB | -6 dB (min at +0.04s after the audible onset; +0.05s raw) | met |
| duck.attack.shipCrash | shipCrash music duck reaches depth | <= 0.04 s | within 1 dB of depth at +0.035s after onset (raw +0.045s) | met |
| duck.depth.terminalCorrupt | terminalCorrupt music duck depth | -4 ±1 dB | -4 dB (min at +0.035s after the audible onset; +0.045s raw) | met |
| duck.attack.terminalCorrupt | terminalCorrupt music duck reaches depth | <= 0.03 s | within 1 dB of depth at +0.025s after onset (raw +0.035s) | met |
| duck.depth.shipLand | shipLand music duck depth | -6 ±1 dB | -6 dB (min at +0.04s after the audible onset; +0.05s raw) | met |
| duck.attack.shipLand | shipLand music duck reaches depth | <= 0.04 s | within 1 dB of depth at +0.035s after onset (raw +0.045s) | met |
| duck.depth.terminalAlarm | terminalAlarm music duck depth | -4 ±1 dB | -4 dB (min at +0.035s after the audible onset; +0.045s raw) | met |
| duck.attack.terminalAlarm | terminalAlarm music duck reaches depth | <= 0.03 s | within 1 dB of depth at +0.025s after onset (raw +0.035s) | met |
| duck.depth.shipCrash@story-lead | shipCrash@story-lead music duck depth | -3 ±1 dB (story-lead cap) | -3 dB (min at +0.04s after the audible onset; +0.05s raw) | met |
| duck.attack.shipCrash@story-lead | shipCrash@story-lead music duck reaches depth | <= 0.04 s | within 1 dB of depth at +0.03s after onset (raw +0.04s) | met |
| duck.cap.shipCrash@story-lead | shipCrash@story-lead music column capped under story lead | DUCK_STORY_LEAD_CAP_DB -3, measured >= -4 dB | -3 dB (cap -3) | met |
| duck.depth.terminalCorrupt@story-lead | terminalCorrupt@story-lead music duck depth | -3 ±1 dB (story-lead cap) | -3 dB (min at +0.03s after the audible onset; +0.04s raw) | met |
| duck.attack.terminalCorrupt@story-lead | terminalCorrupt@story-lead music duck reaches depth | <= 0.03 s | within 1 dB of depth at +0.02s after onset (raw +0.03s) | met |
| duck.cap.terminalCorrupt@story-lead | terminalCorrupt@story-lead music column capped under story lead | DUCK_STORY_LEAD_CAP_DB -3, measured >= -4 dB | -3 dB (cap -3) | met |
| gain.safety | safety stage static gain after SAFETY_MAKEUP_COMP_DB | |gain| <= 0.05 dB | -0.005 dB (baked 2.905) | met |
| gain.limiter | limiter stage static gain after LIM_MAKEUP_COMP_DB | |gain| <= 0.05 dB | 0 dB (baked 0.57) | met |
| gain.tail | shipped tail vs pre-Stage-2 tail static gain at -30 dBFS | within 0.1 dB | -0.007 dB (tail carries 1.986 dB = TAIL_REFERENCE_GAIN_DB) | met |
| latency | LATENCY_COMP_MUSIC_PATH_S measured after the limiter | published as a named constant | music 25.215 ms, sfx 10.34 ms (before: music 14.875 ms, sfx 0) | met |
| ceiling | ceiling true peak on -6…+12 dBFS bursts (4× oversampled) | <= -1 dBTP | -1.581 dBTP worst | met |
| smoothness | smoothness battery | 0 violations | sandbox 0, eraBuild 0, storyHandoff 0 | met |
| tp.all | true peak on every after render | <= -1 dBTP | worst -4.92 dBTP | met |

Overall: some terms NOT met (see README deviations)
