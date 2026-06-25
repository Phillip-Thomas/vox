# Product Brief

## User Job

A player wants to start Paravoxia normally, or opt into a small co-op alpha by creating a room or joining a friend with an invite code.

## Primary Action

Create a co-op room from the landing menu.

## Secondary Actions

- Join a room by invite code.
- Copy the generated invite code.
- Read connection/auth/server status.
- Continue offline through the existing Play action.

## Success Proxy

With co-op env vars enabled and the state server running, a player can authenticate, connect to `/play`, create or join a room, and keep that socket session alive when entering the game.

## Language Constraints

- No placeholder language.
- Be explicit that this is co-op alpha plumbing, not final world sync.
- Avoid unsupported claims about persistence, player counts, or MMO readiness.

## Required States

- Co-op disabled by env flag.
- Missing server URL or Firebase config.
- Signing in / connecting / joining.
- Connected with invite code.
- Recoverable error.
