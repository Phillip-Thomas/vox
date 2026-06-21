# Screenshot Report

Canonical preview URL: `http://127.0.0.1:4174/`

Screenshots:

- Desktop: `/tmp/paravox-desktop.png`
- Mobile: `/tmp/paravox-mobile.png`

Checks:

- Page identity: `title=Paravox`
- HTTP status: `200`
- First canvas visible: yes
- Framework overlay: no Vite overlay detected
- Interaction proof: Debug checkbox toggled and debug state rendered `Controls: idle`
- Canvas dimensions:
  - Desktop: `1440x900`
  - Mobile: `585x1266` backing canvas, `390x844` CSS viewport
- Pixel/nonblank check:
  - Desktop: 3421 sampled colors, nonblank/extrema across RGB channels
  - Mobile: 2685 sampled colors, nonblank/extrema across RGB channels

Console:

- No app errors captured.
- Warnings captured:
  - deprecated initialization parameters warning
  - desktop-only WebGL `ReadPixels` performance warnings during screenshot capture
