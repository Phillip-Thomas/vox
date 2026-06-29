# Design Directions

## Direction A: Grass-Local Wind Patch

Keep wind params inside `grassProfile.ts`, add a few new uniforms, and tune the shader. This is fastest, but it leaves future trees/audio with no shared source of truth.

## Direction B: Shared Planet Wind Profile

Create `windProfile.ts` as a deterministic planet dynamic. Grass profile references it, and grass material consumes profile gust direction, strength, speed, scale, turbulence, and veer. Other systems can migrate later without changing grass again.

## Direction C: Runtime Wind System Store

Create a global runtime wind service with live sampling APIs. This is more future-proof, but it is too much architecture for the immediate visual request and risks broad state churn.

