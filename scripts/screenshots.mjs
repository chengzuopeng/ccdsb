#!/usr/bin/env node
/**
 * Take dashboard screenshots for the README.
 *
 *   node scripts/screenshots.mjs
 *
 * Requires the dev server (or production CLI) running on http://127.0.0.1:3737.
 * Drops files into docs/screenshots/.
 *
 * Run-once: pnpm dlx playwright install chromium
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'docs/screenshots');
const BASE = process.env.CCDSB_BASE || 'http://127.0.0.1:3737';

const VIEWPORT = { width: 1440, height: 900 };

const SHOTS = [
  // Overview — English / Dark (hero)
  { name: 'overview-en-dark.png', path: '/', locale: 'en', theme: 'dark' },
  // Overview — Chinese / Light (i18n + theme showcase)
  { name: 'overview-zh-light.png', path: '/', locale: 'zh', theme: 'light' },
  // Usage page — English / Dark
  { name: 'usage-en-dark.png', path: '/usage', locale: 'en', theme: 'dark' },
  // Sessions page — English / Dark
  { name: 'sessions-en-dark.png', path: '/sessions', locale: 'en', theme: 'dark' },
  // Models page — English / Dark
  { name: 'models-en-dark.png', path: '/models', locale: 'en', theme: 'dark' },
  // Projects page — English / Dark
  { name: 'projects-en-dark.png', path: '/projects', locale: 'en', theme: 'dark' },
  // Settings page — Chinese / Light (showing preferences in CN)
  { name: 'settings-zh-light.png', path: '/settings', locale: 'zh', theme: 'light' },
];

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2, // retina-quality
  });

  const url = new URL(BASE);

  for (const s of SHOTS) {
    await context.clearCookies();
    await context.addCookies([
      { name: 'ccdsb_locale', value: s.locale, domain: url.hostname, path: '/' },
      { name: 'ccdsb_theme', value: s.theme, domain: url.hostname, path: '/' },
    ]);
    const page = await context.newPage();
    await page.goto(BASE + s.path, { waitUntil: 'networkidle' });
    // Disable caret, just in case
    await page.evaluate(() => document.activeElement?.blur?.());
    // Make sure animations have settled (we already disabled chart animations,
    // but the live block timer ticks every 1s)
    await page.waitForTimeout(800);

    const out = `${OUT}/${s.name}`;
    await page.screenshot({ path: out, type: 'png', fullPage: false });
    console.log(`✓ ${s.name}`);
    await page.close();
  }

  await browser.close();
  console.log(`\nDone. ${SHOTS.length} screenshots written to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
