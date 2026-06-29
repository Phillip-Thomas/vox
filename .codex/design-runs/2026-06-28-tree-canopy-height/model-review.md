# Model Review

## Review Notes

- The root defect was the profile height floor, not only tree field placement.
- Raising profile height required matching crown radius, leaf budget, leaf size, and base radius modestly.
- The in-world instance scale floor also needed a lift because `0.8x` could visually undo the profile fix.
- Harness framing had to be tuned after the height change so screenshots did not crop or undersell the result.

## Decision

Proceed with bounded profile-level height scaling and a conservative in-world instance range of `0.92..1.4`.
