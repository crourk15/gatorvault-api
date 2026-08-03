'use strict';

/**
 * Prove homepage ↑ back-to-top lands on the right edge even when
 * --mobile-gutter / spacing tokens are broken (the prod failure mode).
 *
 * Uses Playwright Chromium at iPhone width. No network required.
 */

const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const ROOT = path.join(__dirname, '..');
const cssPath = path.join(ROOT, 'lib/mobile-native-framework.css');
const css = fs.readFileSync(cssPath, 'utf8');

async function measure(page, injectBrokenTokens) {
  await page.setContent(`<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
${css}
${injectBrokenTokens ? `
:root {
  /* Reproduce the recruiting-hub-tokens cycle that emptied --mobile-gutter. */
  --space-md: var(--space-md);
  --space-lg: var(--space-lg);
  --space-xl: var(--space-xl);
  --mobile-gutter: var(--space-lg);
}
` : ''}
body { margin: 0; min-height: 2000px; background: #001a33; }
</style>
</head>
<body>
  <button type="button" class="gv-mobile-back-top" data-testid="mobile-back-to-top" aria-label="Back to top">↑</button>
</body>
</html>`);

  const button = page.getByTestId('mobile-back-to-top');
  await button.waitFor({ state: 'visible' });
  const box = await button.boundingBox();
  if (!box) throw new Error('back-to-top has no bounding box');
  const viewport = page.viewportSize();
  return { box, viewport };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['iPhone 13'],
  });
  const page = await context.newPage();

  try {
    const healthy = await measure(page, false);
    const brokenTokens = await measure(page, true);

    const checks = [
      ['healthy.right-edge', healthy.box.x + healthy.box.width > healthy.viewport.width * 0.75],
      ['healthy.not-left-edge', healthy.box.x > 40],
      ['broken-tokens.right-edge', brokenTokens.box.x + brokenTokens.box.width > brokenTokens.viewport.width * 0.75],
      ['broken-tokens.not-left-edge', brokenTokens.box.x > 40],
      ['tap-target', healthy.box.width >= 44 && healthy.box.height >= 44],
    ];

    const failed = checks.filter(([, ok]) => !ok);
    console.log(
      JSON.stringify(
        {
          healthy: { x: healthy.box.x, width: healthy.box.width, viewport: healthy.viewport.width },
          brokenTokens: {
            x: brokenTokens.box.x,
            width: brokenTokens.box.width,
            viewport: brokenTokens.viewport.width,
          },
          checks: Object.fromEntries(checks),
        },
        null,
        2
      )
    );

    if (failed.length) {
      console.error('[verify-home-back-to-top-geometry] FAIL');
      failed.forEach(([name]) => console.error(' -', name));
      process.exit(1);
    }

    console.log('[verify-home-back-to-top-geometry] OK');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[verify-home-back-to-top-geometry] ERROR', err);
  process.exit(1);
});
