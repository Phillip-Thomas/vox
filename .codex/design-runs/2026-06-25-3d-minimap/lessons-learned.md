# Lessons Learned

- Playwright's locator click can hang on this landing screen under headless Chromium, likely around the pointer-lock/scroll action path. For reproducible visual QA, wait for the enabled Play button and trigger the DOM click with `page.evaluate`.
- A small HUD-only R3F canvas can be pixel-verified reliably when `preserveDrawingBuffer` is enabled for that canvas.
- Avoid requiring idle animation in HUD visual QA when stability is an intentional part of the interaction model.
- Right-side placement works better for the current Paravoxia HUD because top-left inventory and bottom-left vitals already own the left side.
- Marker caps and structure-cell dedupe should stay in pure helpers so future minimap additions can be tested without launching the game.
