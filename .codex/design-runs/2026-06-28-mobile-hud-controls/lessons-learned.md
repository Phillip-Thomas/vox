# Lessons Learned

- For Paravoxia mobile HUD work, reserve bottom-left exclusively for the movement joystick and bottom-right for thumb actions.
- Survival vitals should live as top-left suit telemetry, with inventory offset below it instead of competing for the same anchor.
- Oxygen and charge meters belong in the same suit telemetry stack; separate center-bottom bars make the HUD feel scattered.
- Jetpack fuel should also live in the suit telemetry stack as a stable `JET` row; separate transient fuel meters fragment the HUD.
- Inventory should default to a compact explicit button on gameplay screens and expand only on demand.
- Normal mobile on-foot actions should stay to three controls unless a mode explicitly requires more.
- Shared HUD chrome helpers and pure layout models make future polish safer than copying inline styles across `App.tsx`, HUD components, and mobile controls.
