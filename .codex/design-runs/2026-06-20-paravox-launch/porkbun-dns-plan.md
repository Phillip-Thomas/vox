# Porkbun DNS Plan

Firebase Hosting custom domains were created for:

- `paravox.com`
- `www.paravox.com` redirecting to `paravox.com`

Required Porkbun DNS updates:

| Host | Type | Value | Action |
| --- | --- | --- | --- |
| `@` | A | `199.36.158.100` | Add |
| `@` | TXT | `hosting-site=paravox-game` | Add |
| `_acme-challenge` | TXT | `CBX3cQPOrOc6AkwCQFsJK3NQj6rqf3liuc1_P2ENSOU` | Add |
| `www` | CNAME | `paravox-game.web.app` | Add |
| `_acme-challenge.www` | TXT | `fVURMd_rpcMvj0MWseDbI6-J4Jxuc_2JPrw7UcUv9yI` | Add |
| `@` | A | `13.248.169.48` | Remove |
| `@` | A | `76.223.54.146` | Remove |
| `www` | A | `13.248.169.48` | Remove |
| `www` | A | `76.223.54.146` | Remove |

Keep existing `@` TXT `v=spf1 -all`.

Automation command once credentials are available:

```bash
PORKBUN_API_KEY=... PORKBUN_SECRET_API_KEY=... python3 .codex/design-runs/2026-06-20-paravox-launch/porkbun-update-dns.py --apply --out .codex/design-runs/2026-06-20-paravox-launch/porkbun-dns-result.json
```
