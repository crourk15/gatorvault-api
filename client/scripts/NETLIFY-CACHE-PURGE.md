# Netlify CDN cache purge (chunk 5814 / stale vault-chunks)

When `rewrite-next-chunk-paths.js` produces new hashed files under `server/js/vault-chunks/`, browsers or the Netlify CDN may still serve old HTML that references deleted chunk hashes.

## Clean deploy checklist

1. Run a full build locally:
   ```bash
   npm run build:netlify
   ```
2. Verify chunk rewrite passed (`assertNoUnrewrittenAppChunkRefs` in merge output).
3. Deploy the entire `server/` artifact (not partial uploads).
4. Purge CDN cache in Netlify UI: **Site configuration → Build & deploy → Post processing → Clear cache and deploy site** (or trigger **Clear cache** after deploy).

There is no Netlify CDN purge API configured in this repo; manual purge in the Netlify dashboard is required after chunk hash changes.

## What the pipeline does

- `client/scripts/rewrite-next-chunk-paths.js` copies App Router chunks to `/js/vault-chunks/` and rewrites HTML/RSC references for all vault export paths listed in `NETLIFY_CHUNK_ASSERT_PREFIXES` and `NETLIFY_CHUNK_ASSERT_FILES`.
