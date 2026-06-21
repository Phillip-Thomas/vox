# Porkbun DNS Plan

Current target domain is `paravoxia.com`.

Firebase Hosting custom domains were created for:

- `paravoxia.com`
- `www.paravoxia.com` redirecting to `paravoxia.com`

Required Porkbun DNS updates:

| Host | Type | Value | Action |
| --- | --- | --- | --- |
| `@` | A | `199.36.158.100` | Add |
| `@` | TXT | `hosting-site=paravox-game` | Add |
| `_acme-challenge` | TXT | `JACFWtOD5x2Y_uyOFCYEzaiqeUGOwACWAmjPRmtRCm4` | Add |
| `www` | CNAME | `paravox-game.web.app` | Add |
| `_acme-challenge.www` | TXT | `KFrplKT84lRZukihqStm7fSpQTJzAfhn3oohyx9GpQ8` | Add |
| `@` | A | `44.230.85.241` | Remove |
| `@` | A | `52.33.207.7` | Remove |
| `www` | CNAME | `uixie.porkbun.com` | Remove |
| `_acme-challenge.www` | CNAME | `uixie.porkbun.com` | Remove |

Keep existing `@` TXT `v=spf1 include:_spf.porkbun.com ~all`.

Automation command once credentials are available:

```bash
PORKBUN_API_KEY=... PORKBUN_SECRET_API_KEY=... python3 .codex/design-runs/2026-06-20-paravox-launch/porkbun-update-dns.py --apply --out .codex/design-runs/2026-06-20-paravox-launch/porkbun-dns-result.json
```
