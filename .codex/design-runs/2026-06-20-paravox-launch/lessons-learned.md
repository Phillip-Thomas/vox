# Lessons Learned

- For this repo, `origin/collision-efficiency-test` was the real launch branch and needed to be fast-forwarded into `master` before deploy.
- Firebase project ID `paravox` was already globally taken; `paravox-game` was available and works with the `paravox.com` custom domain.
- Headless WebGL screenshot capture is slow but viable with escalated host browser execution.
- Porkbun DNS automation needs explicit API credentials; no local credentials were present in this environment.
