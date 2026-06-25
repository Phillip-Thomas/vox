# Paravoxia State Server

Dedicated Phase 1 co-op state server for Paravoxia.

This package is intentionally separate from the static Vite game in `main/`.
Firebase Hosting keeps serving the SPA, while realtime play connects directly to
this Cloud Run service over WebSocket.

## Local Development

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

Useful local flags:

- `PARAVOXIA_AUTH_DISABLED=true` lets any non-empty token act as a local player id.
- `DATABASE_URL=` can stay empty while using in-memory rooms.

Health checks:

```bash
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz
```

## HTTP API

All `/v1/**` routes require `Authorization: Bearer <Firebase ID token>`.

- `POST /v1/rooms` creates a room.
- `POST /v1/rooms/:inviteCode/join` joins a room by invite code.
- `GET /v1/rooms/:roomId` returns a room summary.

## WebSocket

Realtime play connects to `/play`.

The server sends `hello`, then the client must send:

```json
{ "type": "auth", "protocolVersion": 1, "token": "<Firebase ID token>" }
```

After `auth_ok`, the client can send `create_room`, `join_room`, `command`,
`pose_update`, `teleport_marker`, and `ping` messages. Protocol types live in
`src/protocol.ts`.

## Persistence

`migrations/001_initial_coop_schema.sql` defines the Neon-ready schema for:

- players and room membership
- worlds with generation schema/fingerprint metadata
- world event log
- voxel edits, structures, collectibles, campfires
- player state, inventory, and `(player_id, world_id)` pose records

Run migrations only after setting `DATABASE_URL`:

```bash
npm run migrate
```
