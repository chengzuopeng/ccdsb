#!/usr/bin/env node
import { fork } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, '..');
const pkg = require(join(packageRoot, 'package.json'));

const { Command } = await import('commander');
const getPortMod = await import('get-port');
const openMod = await import('open');
const getPort = getPortMod.default;
const open = openMod.default;

const program = new Command();
program
  .name('ccgauge')
  .description(pkg.description ?? 'Claude Code Dashboard')
  .version(pkg.version ?? '0.0.0')
  .option('-p, --port <port>', 'preferred port', '3737')
  .option('-h, --host <host>', 'bind host', '127.0.0.1')
  .option('--no-open', 'do not auto-open the browser')
  .option('--dir <path>', 'override Claude config dir (will append /projects)')
  .option('-q, --quiet', 'silence Next.js output')
  .parse();

const opts = program.opts();

const standaloneEntry = join(packageRoot, '.next', 'standalone', 'server.js');
if (!existsSync(standaloneEntry)) {
  console.error(`
[ccgauge] Build artifact not found:
  ${standaloneEntry}

If you installed ccgauge from npm: please reinstall — the published package should
include the standalone build.

If you are running from source: build first with
  $ pnpm build
or run the dev server with
  $ pnpm dev
`);
  process.exit(1);
}

const preferred = parseInt(String(opts.port), 10);
const port = await getPort({
  port: [preferred, preferred + 1, preferred + 2, preferred + 3, 0],
});

const env = {
  ...process.env,
  PORT: String(port),
  HOSTNAME: opts.host,
  NODE_ENV: 'production',
};
if (opts.dir) {
  env.CCGAUGE_CONFIG_DIR = String(opts.dir);
}

const child = fork(standaloneEntry, [], {
  cwd: dirname(standaloneEntry),
  env,
  stdio: opts.quiet ? ['ignore', 'ignore', 'inherit', 'ipc'] : 'inherit',
});

const url = `http://${opts.host}:${port}`;

let opened = false;
async function tryOpen() {
  if (opened) return;
  opened = true;
  if (opts.open === false) {
    printReady(url);
    return;
  }
  try {
    await open(url);
  } catch {
    // ignore — user may be on remote without a browser
  }
  printReady(url);
}

waitForUrl(url, 15_000)
  .then(tryOpen)
  .catch((err) => {
    console.error(`\n[ccgauge] failed to start: ${err.message}\n`);
    child.kill('SIGTERM');
    process.exit(1);
  });

function shutdown(signal) {
  return () => {
    if (!child.killed) child.kill(signal);
    process.exit(0);
  };
}
process.on('SIGINT', shutdown('SIGINT'));
process.on('SIGTERM', shutdown('SIGTERM'));
process.on('exit', () => {
  if (!child.killed) child.kill('SIGTERM');
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

async function waitForUrl(target, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(target, { method: 'HEAD' });
      if (res.status < 500) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw lastErr ?? new Error('server did not start in time');
}

function printReady(url) {
  const banner = [
    '',
    '  \x1b[1m\x1b[38;2;201;100;66mccgauge\x1b[0m  Claude Code Dashboard',
    '',
    `   ➜  Local:   \x1b[36m${url}\x1b[0m`,
    `   ➜  Press \x1b[2mCtrl+C\x1b[0m to stop`,
    '',
  ].join('\n');
  process.stdout.write(banner + '\n');
}
