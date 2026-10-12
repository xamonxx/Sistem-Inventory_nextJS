---
type: server-actions
status: verified
last_verified: 2026-10-12
source_files: [src/app/login/actions.ts]
related: ["[[Login-and-Session-Flow]]", "[[Authentication-and-Access]]"]
tags: [api, server-actions, auth]
---
# Authentication Server Actions

| Action | Input | Effect |
|---|---|---|
| `loginAction` | FormData username/password | Rate limit, bcrypt, create JWT cookie, redirect `/` |
| `logoutAction` | none | Delete session cookie, redirect `/login` |

`loginAction` tidak mengekspos apakah username ada. Proxy headers hanya dipercaya jika `TRUST_PROXY_HEADERS=true`.
