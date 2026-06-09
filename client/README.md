# GatorVault client (frontend)

The GatorVault **frontend is not a separate npm package** in this repo. Static pages and client-side JavaScript live alongside the API in `server/`:

| File | Role |
|------|------|
| `server/index.html` | Main Insider site |
| `server/article.html` | Article pages |
| `server/player.html` | Player profiles |
| `server/gv-global.js` | Shared client utilities |
| `server/gv-global.css` | Shared styles |

Netlify publishes `server/` directly (`netlify.toml` → `publish = "server"`).

To work on the UI locally, start the API from the repo root:

```bash
npm start
# open http://localhost:3000
```

A future split into a dedicated `client/` build (Vite/React/TS) would live here; until then, edit files under `server/`.
