/**
 * Trigger a Netlify production build with cache cleared.
 * Usage: NETLIFY_BUILD_HOOK_URL=https://api.netlify.com/... node scripts/trigger-netlify-deploy.js
 */
const hook = process.env.NETLIFY_BUILD_HOOK_URL;
if (!hook) {
  console.error('Set NETLIFY_BUILD_HOOK_URL to your Netlify build hook URL.');
  process.exit(1);
}

const url = hook.includes('?') ? `${hook}&clear_cache=true` : `${hook}?clear_cache=true`;

fetch(url, { method: 'POST' })
  .then((res) => {
    if (!res.ok) {
      throw new Error(`Netlify build hook failed (${res.status})`);
    }
    console.log('Netlify build triggered with clear_cache=true');
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
