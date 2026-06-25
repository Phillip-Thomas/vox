# Lessons Learned

- Browser validation for co-op should support a local auth lane. Firebase anonymous sign-in is correct for production but adds avoidable latency and flake to auth-disabled local state-server tests.
- Roster state should be server-owned and broadcast as its own message. Inferring it from pose traffic or local room state leaves gaps around joins, disconnects, and hidden tabs.
- WebGL-heavy landing/game scenes can make Playwright text polling and screenshots slow. Future capture scripts should use short read timeouts, longer screenshot timeouts, and a lighter validation route if one is introduced.
