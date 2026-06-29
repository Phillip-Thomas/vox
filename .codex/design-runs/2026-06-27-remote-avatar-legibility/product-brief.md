# Product Brief

## Surface

Remote player avatars rendered inside the active Paravoxia world by `PlayerAvatarPoseHarness` and `PlayerAvatar`.

## User Job

A co-op player needs to quickly understand where teammates are, who they are, where they are facing, and whether they are swimming, jetpacking, mining, building, or idle/walking.

## Page/Surface Goal

Turn remote avatars from "colored capsules with small props" into a launch-quality co-op readability layer while keeping the implementation render-only.

## Primary Action

There is no click target. The primary player action is rapid visual recognition during gameplay.

## Success Proxy

From a desktop or mobile screenshot, a reviewer can identify the remote avatar, label, facing cue, and current action state without reading source code or relying only on color.

## Required States

- Idle/walk: neutral EVA silhouette plus orientation marker.
- Swim: horizontal posture plus water/flow beacon.
- Jetpack: visible flame and vertical thrust beacon.
- Mine: tool/strike accessory plus mining beacon/progress.
- Build: build projection accessory plus build beacon.
- Multiple players: stable colors and compact labels.
- Long labels: nameplate width stays bounded.

## Language And Claims

Visible language is limited to roster-backed display names or short ids. No explanatory in-game copy should be added.
