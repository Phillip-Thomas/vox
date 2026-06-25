# State Server Deployment

## Firebase Hosting

The current `firebase.json` keeps Hosting as a static SPA/CDN layer:

- `main/dist` is the Hosting public directory.
- `**` rewrites to `index.html`.
- There is no realtime WebSocket rewrite through Hosting.

Realtime clients should connect directly to the Cloud Run service URL, for
example:

```text
wss://paravoxia-state-server-724227850753.us-central1.run.app/play
```

Lobby HTTP can also call Cloud Run directly:

```text
https://paravoxia-state-server-724227850753.us-central1.run.app/v1/rooms
```

A Hosting rewrite for lobby HTTP can be added later if it materially improves UX,
but WebSocket traffic should stay direct to Cloud Run.

## Cloud Run

Cloud Run requires billing to be enabled on the Google Cloud project before the
first deploy can enable:

- `artifactregistry.googleapis.com`
- `cloudbuild.googleapis.com`
- `run.googleapis.com`
- `containerregistry.googleapis.com`

Build and deploy the server container from `server/`:

```bash
cd server
gcloud run deploy paravoxia-state-server \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --env-vars-file /tmp/paravoxia-cloudrun-env.yaml
```

Use an env file so comma-separated origins are not split by gcloud:

```yaml
FIREBASE_PROJECT_ID: paravox-game
PARAVOXIA_ALLOWED_ORIGINS: "https://paravoxia.com,https://www.paravoxia.com,https://paravox-game.web.app"
PARAVOXIA_AUTH_DISABLED: "false"
```

Current service URL:

```text
https://paravoxia-state-server-724227850753.us-central1.run.app
```

For first-time source deploys, the default build service account may also need:

```bash
gcloud projects add-iam-policy-binding paravox-game \
  --member=serviceAccount:724227850753-compute@developer.gserviceaccount.com \
  --role=roles/run.builder \
  --condition=None
```

The service itself verifies Firebase ID tokens. Cloud Run can be publicly
reachable because application auth is enforced at `/v1/**` and `/play`.

## Required Secrets / Env

- `FIREBASE_PROJECT_ID=paravox-game`
- `DATABASE_URL=<Neon pooled connection string>` once persistence is enabled
- `PARAVOXIA_ALLOWED_ORIGINS=https://paravoxia.com,https://www.paravoxia.com`
- `PARAVOXIA_AUTH_DISABLED=false`

For local development only, `PARAVOXIA_AUTH_DISABLED=true` can be used to bypass
Firebase token verification.

For local browser validation against an auth-disabled state server, the web app can
also use `VITE_PARAVOXIA_LOCAL_AUTH=1`. Do not set this in production; production
clients should keep using Firebase anonymous auth, and the Cloud Run service should
keep `PARAVOXIA_AUTH_DISABLED=false`.

## Neon

Use the pooled Neon connection string for Cloud Run. Run migrations before using
persistent rooms:

```bash
cd server
DATABASE_URL='<neon connection string>' npm run migrate
```

When `DATABASE_URL` is configured, accepted reliable-lane world commands are
persisted transactionally before broadcast and replayed from Neon by
`(room_id, world_id, seq)` cursor. Without `DATABASE_URL`, local/dev rooms fall
back to in-memory state.

## Health

Use `/readyz` for the public live check:

```bash
curl https://paravoxia-state-server-724227850753.us-central1.run.app/readyz
```

The deployed service should report `databaseConfigured: true` once the Cloud Run
environment includes `DATABASE_URL`.

## Live Smoke Test

After Cloud Run deploy returns a service URL and Firebase anonymous auth is
enabled, run:

```bash
cd server
PARAVOXIA_STATE_SERVER_URL='https://<cloud-run-service-url>' \
FIREBASE_WEB_API_KEY='<firebase web api key>' \
npm run smoke:room
```

The smoke test signs in three anonymous Firebase users, creates a room, joins a
second player, verifies reliable replication for the current shared-world command
types, and late-joins a third player to verify snapshot replay.
