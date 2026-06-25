# Product Brief

## User Goal

Players running invited co-op need immediate confidence that the room is live, the invite code is correct, and the expected people are connected.

## Primary Action

Create or join a co-op room, then keep playing without opening debug tools to know whether teammates are present.

## Success Proxy

- Landing panel shows room roster and connected/disconnected state.
- In-game badge shows invite/status plus player count.
- Server/client protocol rejects malformed roster messages.
- Disconnect/reconnect updates the roster without a page refresh.
- Error text distinguishes setup, room, auth, version, and transport failures better than a generic socket failure.

## Language Constraints

- Keep copy short and diegetic.
- Avoid promising MMO-scale social features.
- Use "room", "invite", "linked", "rejoining", and "crew" style labels only where they are accurate.
