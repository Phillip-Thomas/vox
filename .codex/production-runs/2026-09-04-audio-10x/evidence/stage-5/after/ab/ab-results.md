# Stage 5 A/B — the four beds (shipped tail) and composedSpread (pre-tail)

| render | s | I before | I after | S-max before | S-max after | TP before | TP after | LRA before | LRA after | composedSpread before | after | smooth |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bed-sandbox-day | 210 | -20.36 | -20.1 | -17.9 (131.1s) | -14.83 (78.3s) | -9.02 | -5.11 | 3.71 | 7.77 | 2.72 | 7.35 | 0→0 |
| bed-sandbox-night | 210 | -20.39 | -20.27 | -18.04 (123.7s) | -14.7 (77.7s) | -8.03 | -5.89 | 3.36 | 8.11 | 2.71 | 7.53 | 0→0 |
| bed-contrast-A | 210 | -20.39 | -19.97 | -16.59 (45s) | -14.06 (45s) | -8.22 | -4.87 | 3.77 | 5.35 | 4.39 | 8.43 | 0→0 |
| bed-contrast-B | 210 | -20.96 | -19.57 | -18.79 (169.7s) | -14.8 (72.4s) | -9.13 | -5.3 | 5.27 | 3.95 | 2.29 | 6.94 | 0→0 |

| id | term | target | measured | verdict |
|---|---|---|---|---|
| bloom.smax.bed-sandbox-day | bed-sandbox-day BLOOM short-term max | -14 ±1 LU | -14.83 LU at 78.3s | met |
| bed.lufs.bed-sandbox-day | bed-sandbox-day bed-alone integrated | -20.5 ±1 LU | -20.1 LU | met |
| bed.tp.bed-sandbox-day | bed-sandbox-day true peak | ≤ -1 dBTP | -5.11 dBTP | met |
| bed.spread.bed-sandbox-day | bed-sandbox-day composedSpread (pre-tail S-max − I) | rises from ≈2.5 toward 6.5 LU | 2.72 → 7.35 LU | met |
| bed.smooth.bed-sandbox-day | bed-sandbox-day smoothness violations | 0 | 0 | met |
| bloom.smax.bed-sandbox-night | bed-sandbox-night BLOOM short-term max | -14 ±1 LU | -14.7 LU at 77.7s | met |
| bed.lufs.bed-sandbox-night | bed-sandbox-night bed-alone integrated | -20.5 ±1 LU | -20.27 LU | met |
| bed.tp.bed-sandbox-night | bed-sandbox-night true peak | ≤ -1 dBTP | -5.89 dBTP | met |
| bed.spread.bed-sandbox-night | bed-sandbox-night composedSpread (pre-tail S-max − I) | rises from ≈2.5 toward 6.5 LU | 2.71 → 7.53 LU | met |
| bed.smooth.bed-sandbox-night | bed-sandbox-night smoothness violations | 0 | 0 | met |
| bloom.smax.bed-contrast-A | bed-contrast-A BLOOM short-term max | -14 ±1 LU | -14.06 LU at 45s | met |
| bed.lufs.bed-contrast-A | bed-contrast-A bed-alone integrated | -20.5 ±1 LU | -19.97 LU | met |
| bed.tp.bed-contrast-A | bed-contrast-A true peak | ≤ -1 dBTP | -4.87 dBTP | met |
| bed.spread.bed-contrast-A | bed-contrast-A composedSpread (pre-tail S-max − I) | rises from ≈2.5 toward 6.5 LU | 4.39 → 8.43 LU | met |
| bed.smooth.bed-contrast-A | bed-contrast-A smoothness violations | 0 | 0 | met |
| bloom.smax.bed-contrast-B | bed-contrast-B BLOOM short-term max | -14 ±1 LU | -14.8 LU at 72.4s | met |
| bed.lufs.bed-contrast-B | bed-contrast-B bed-alone integrated | -20.5 ±1 LU | -19.57 LU | met |
| bed.tp.bed-contrast-B | bed-contrast-B true peak | ≤ -1 dBTP | -5.3 dBTP | met |
| bed.spread.bed-contrast-B | bed-contrast-B composedSpread (pre-tail S-max − I) | rises from ≈2.5 toward 6.5 LU | 2.29 → 6.94 LU | met |
| bed.smooth.bed-contrast-B | bed-contrast-B smoothness violations | 0 | 0 | met |
| chip.hash.bare-bed | bare-bed fingerprint unchanged (pulse/rail gated above material); pcm d713e7fa→72e39cc8 informational | 0249349aa58b6d5b | 0249349aa58b6d5b | met |
| chip.hash.color-bed | color-bed fingerprint unchanged (pulse/rail gated above material); pcm ad732275→a86cfe90 informational | 6a81f00121858af8 | 6a81f00121858af8 | met |
