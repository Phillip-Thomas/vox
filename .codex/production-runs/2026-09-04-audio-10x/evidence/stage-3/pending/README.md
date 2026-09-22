# Stage 3 pending-wiring hold (closed)

The Stage 2 cohesion judgement held the bundleAt / SFX-forward-scheduling wiring at the eleven call sites
(and any edit under audioCore.ts / mix/**) until the amended C6 was tri-signed in draft-v4. Stage 3 built
parts 1–3 (scheduleHit + caps + applyRails dirty check, the tonic chains, the MOODS-as-constraints layer)
under that hold; the wiring was prepared and then landed directly once the coordinator reported draft-v4
signed (sha256 672de45a0c8257d334d052cbedf4247fd09b0f1dba385cc5fb9d06e04459d41d), so no separate patch
file was ever needed here. The mix/** edits made after the signature are the S2-D10 documentation +
tests in duckMatrix.ts/.test.ts and the AUTOMATION_CADENCE_S retune in mixTuning.ts (with its Stage 2
test deriving from the constant). audioCore.ts was not edited by Stage 3.
