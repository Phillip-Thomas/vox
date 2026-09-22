# Stage 1 A/B — six owner excerpts plus gate renders

| render | s | I before | I after | ΔI (LU) | S-max before | S-max after | TP before | TP after | LRA b→a | corr b→a | bands before [<200, 200–800, 800–3.2k, >3.2k] | bands after | smooth b→a |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bed-sandbox-day | 210 | -24.55 | -20.48 | 4.06 | -21.73 | -18.12 | -11.46 | -9.37 | 3.75→3.59 | 0.962→0.936 | [0.863, 0.074, 0.06, 0.003] | [0.83, 0.115, 0.052, 0.003] | 0→0 |
| bed-sandbox-night | 210 | -22.93 | -20.51 | 2.42 | -20.08 | -18.25 | -8.59 | -8.43 | 3.49→3.26 | 0.961→0.943 | [0.848, 0.112, 0.04, 0] | [0.846, 0.124, 0.03, 0] | 0→0 |
| bed-contrast-A | 210 | -25.02 | -20.53 | 4.49 | -20.24 | -16.88 | -6.57 | -8.65 | 4.03→3.67 | 0.967→0.929 | [0.872, 0.092, 0.036, 0.001] | [0.82, 0.14, 0.038, 0.002] | 0→0 |
| bed-contrast-B | 210 | -25.29 | -21.07 | 4.22 | -22.88 | -18.94 | -11.86 | -9.47 | 5.08→5.13 | 0.968→0.944 | [0.876, 0.076, 0.047, 0.002] | [0.849, 0.109, 0.04, 0.002] | 0→0 |
| story-beat | 90 | -19.95 | -20.18 | -0.23 | -17.87 | -18.28 | -8.59 | -9.64 | 2.55→2.4 | 0.872→0.875 | [0.703, 0.223, 0.07, 0.004] | [0.702, 0.223, 0.071, 0.004] | 0→0 |
| era-transition | 120 | -26.1 | -22.58 | 3.53 | -22.57 | -18.94 | -5.12 | -9.03 | 11.17→15.18 | 0.978→0.958 | [0.86, 0.093, 0.045, 0.002] | [0.837, 0.119, 0.042, 0.002] | 12→12 |
| bare-bed | 48 | -34.53 | -34.53 | 0 | -34.17 | -34.17 | -25.16 | -25.17 | 0.46→0.46 | 1→1 | [0.48, 0.402, 0.101, 0.017] | [0.48, 0.402, 0.101, 0.017] | 51→54 |
| bare-story-ch1-fixed | 60 | -35.96 | -35.95 | 0.01 | -34.17 | -34.17 | -25.29 | -25.3 | 16.57→16.57 | 1→1 | [0.458, 0.422, 0.103, 0.017] | [0.458, 0.422, 0.103, 0.017] | 56→54 |
| color-bed | 48 | -27.27 | -27.28 | -0.01 | -26.57 | -26.58 | -19.17 | -19.21 | 1.44→1.44 | 1→1 | [0.849, 0.131, 0.018, 0.002] | [0.849, 0.131, 0.018, 0.002] | 0→0 |
| bed-check | 90 | -23.14 | -20.41 | 2.73 | -19.38 | -18.75 | -9.7 | -9.15 | 6.88→3.26 | 0.932→0.922 | [0.824, 0.127, 0.048, 0.002] | [0.819, 0.138, 0.041, 0.002] | 0→0 |
| combined-check | 90 | -23.13 | -20.4 | 2.73 | -19.38 | -18.75 | -9.7 | -9.15 | 6.84→3.26 | 0.932→0.922 | [0.824, 0.127, 0.048, 0.002] | [0.819, 0.138, 0.041, 0.002] | 0→0 |

## Bare/colour-era regression

- **bare-bed**: before pcm 348ee6f5ebf5cb36 / fp 4c88561cccfe8e2e
  - after (glue bypassed): pcm c483381b5e1ec7a6 pcmIdentical=false fingerprintIdentical=true; 16-bit WAV identical=false, max |Δ| 1 LSB (-90.31 dBFS), 8 differing samples, first at 0.786s
  - verdict: PASS — fingerprint identical=true, max |Δ| ≤ 2 LSB (≤ −84 dBFS)=true (the differing-sample count is a per-run observation at the renderer's float floor, not a bound)
  - after (with glue): ΔI 0 LU, fingerprintIdentical=false, max |Δ| 2877 LSB
- **bare-story-ch1-fixed**: before pcm 372f93d385d58141 / fp 3c411ae3ca68c854
  - after (glue bypassed): pcm 770b0e3f91dee7af pcmIdentical=false fingerprintIdentical=true; 16-bit WAV identical=false, max |Δ| 1 LSB (-90.31 dBFS), 6 differing samples, first at 0.786s
  - verdict: PASS — fingerprint identical=true, max |Δ| ≤ 2 LSB (≤ −84 dBFS)=true (the differing-sample count is a per-run observation at the renderer's float floor, not a bound)
  - after (with glue): ΔI 0.01 LU, fingerprintIdentical=false, max |Δ| 2877 LSB
- **color-bed**: before pcm 662869b06ba26c49 / fp 91dbe5785974976c
  - after (glue bypassed): pcm 7f4125c41c8fc7b4 pcmIdentical=false fingerprintIdentical=true; 16-bit WAV identical=false, max |Δ| 1 LSB (-90.31 dBFS), 134 differing samples, first at 3.718s
  - verdict: PASS — fingerprint identical=true, max |Δ| ≤ 2 LSB (≤ −84 dBFS)=true (the differing-sample count is a per-run observation at the renderer's float floor, not a bound)
  - after (with glue): ΔI -0.01 LU, fingerprintIdentical=false, max |Δ| 6199 LSB

## Smoothness battery

- after sandbox: {"seconds":180,"planetSeed":5,"archetype":"verdant","bars":59,"analysis":{"seconds":180,"peak":0.34597405791282654,"rms":0.10183785818677549,"nanCount":0,"clipCount":0,"longestSilenceS":0,"maxWindowRms":0.12197031146766454,"maxSmoothnessDeltaRms":0.013108288604148921,"maxSmoothnessDeltaAtS":22.5,"ma
- after eraBuild: {"seconds":80,"planetSeed":5,"archetype":"verdant","bars":26,"analysis":{"seconds":80,"peak":0.3138914406299591,"rms":0.08707597869041099,"nanCount":0,"clipCount":0,"longestSilenceS":0,"maxWindowRms":0.12007426172692959,"maxSmoothnessDeltaRms":0.010656244596198156,"maxSmoothnessDeltaAtS":51.2,"maxSm
- after storyHandoff: {"seconds":72,"planetSeed":5,"archetype":"verdant","bars":14,"analysis":{"seconds":72,"peak":0.3243124783039093,"rms":0.07603145872036342,"nanCount":0,"clipCount":0,"longestSilenceS":0,"maxWindowRms":0.1196950370382425,"maxSmoothnessDeltaRms":0.02791898936611556,"maxSmoothnessDeltaAtS":18.1,"maxSmoo
- before sandbox: {"seconds":180,"planetSeed":5,"archetype":"verdant","bars":59,"analysis":{"seconds":180,"peak":0.3042568266391754,"rms":0.07576466222741407,"nanCount":0,"clipCount":0,"longestSilenceS":0,"maxWindowRms":0.10172406056629703,"maxSmoothnessDeltaRms":0.006820406192513465,"maxSmoothnessDeltaAtS":111.3,"ma
- before eraBuild: {"seconds":80,"planetSeed":5,"archetype":"verdant","bars":26,"analysis":{"seconds":80,"peak":0.21924377977848053,"rms":0.05966147363700329,"nanCount":0,"clipCount":0,"longestSilenceS":0,"maxWindowRms":0.07960564939863796,"maxSmoothnessDeltaRms":0.004611358766145671,"maxSmoothnessDeltaAtS":41.3,"maxS
- before storyHandoff: {"seconds":72,"planetSeed":5,"archetype":"verdant","bars":14,"analysis":{"seconds":72,"peak":0.33355945348739624,"rms":0.06582340006020648,"nanCount":0,"clipCount":0,"longestSilenceS":0,"maxWindowRms":0.1004475174361362,"maxSmoothnessDeltaRms":0.020631700822231598,"maxSmoothnessDeltaAtS":17.8,"maxSm
