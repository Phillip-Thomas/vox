# Screenshot Report

Preview URL: http://127.0.0.1:5173/

## Desktop

- Screenshot: `screenshots/desktop-1440x900.png`
- Minimap bounds: x 1236, y 72, width 190, height 196.140625
- Canvas: 140 x 140
- Lit pixels: 7368 then 7364
- Animated hash: 1703608369 -> 3406633699
- Console errors: none
- Result: pass

## Mobile

- Screenshot: `screenshots/mobile-390x844.png`
- Minimap bounds: x 234, y 72, width 144, height 156.796875
- Canvas: 162 x 162
- Lit pixels: 9805 then 9809
- Animated hash: 3030963801 -> 1519187339
- Console errors: none
- Result: pass

## Notes

- Desktop placement clears inventory, vitals, center prompts, and top-right buttons.
- Mobile placement clears inventory and touch controls, with the panel directly below the top action buttons.
- Canvas-pixel checks confirm the 3D minimap is not blank and is moving across frames.
- Active face label and face-local UV guide render in both viewports.
- The minimap cube now holds a stable face orientation; scanner motion remains from the ring while heading changes are represented by the arrow.
- The current face is caticorner and predominant; rear/connector edges are dashed and subordinate.
- The minimap geometry now fits inside the panel with padding, and gameplay cube surface coordinates map to the visible face edge.
