# Lessons Learned

- Feature-flagged alpha UI should be hidden entirely when the flag is off; showing env-var setup text in the public landing menu reads like internal tooling.
- The Paravoxia mobile landing footer must yield to open panels because the menu column can grow vertically on narrow screens.
- For co-op UI work, keep the connection/session controller outside the landing component so the socket can survive entering gameplay.
