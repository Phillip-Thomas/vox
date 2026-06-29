# Run Summary

## Iteration 1

Changed tree sizing at the species profile source of truth:

- Profile height moved from roughly `3.5..7.5` to a bounded `5.6..10.9`.
- Frond and wispy now have a `7.0` minimum.
- Crown radius, trunk base radius, attractor count, leaf budget, and leaf size scale modestly with height.
- In-world instance scale moved from `0.8..1.3` to `0.92..1.4`.
- Tree-test harness now reports trunk height and crown radius.

## Evidence

- Desktop silhouette capture measured `5.92..10.35`.
- Desktop variety capture measured `6.36..10.28`.
- Mobile close-up and in-world under-canopy screenshots captured.
- `npm run verify` passed.

## Server

Existing server reused: `http://127.0.0.1:5173`.
No server started or stopped by this run.
