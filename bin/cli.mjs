#!/usr/bin/env node
import { fork, spawn } from 'node:child_process';
import { closeSync, createReadStream, existsSync, openSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
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
const openBrowser = openMod.default;

const STATE_DIR = process.env.CCGAUGE_STATE_DIR || join(os.homedir(), '.ccgauge');
const STATE_FILE = join(STATE_DIR, 'state.json');
const DEFAULT_LOG_FILE = join(STATE_DIR, 'ccgauge.log');
const STATE_VERSION = 1;
const DEFAULT_PORT = '3737';
const DEFAULT_HOST = '127.0.0.1';
const COMMAND_NAMES = new Set(['start', 'stop', 'restart', 'status', 'open', 'logs']);
const VALUE_OPTIONS = new Set(['-p', '--port', '-H', '--host', '--dir', '--log', '-n', '--lines']);

function browserHost(host) {
  if (!host || host === '0.0.0.0' || host === '::' || host === '[::]') return '127.0.0.1';
  return host;
}

function buildUrl(host, port) {
  return `http://${browserHost(host)}:${port}`;
}

function safeKill(pid, signal) {
  if (!pid) return false;
  try {
    process.kill(pid, signal);
    return true;
  } catch (err) {
    if (err && err.code === 'ESRCH') return false;
    throw err;
  }
}

function addStartOptions(cmd) {
  return cmd
    .option('-p, --port <port>', 'preferred port', DEFAULT_PORT)
    .option('-H, --host <host>', 'bind host', DEFAULT_HOST)
    .option('--no-open', 'do not auto-open the browser (foreground only)')
    .option('--dir <path>', 'override Claude config dir (will append /projects)')
    .option('-q, --quiet', 'silence Next.js output')
    .option('-b, --background', 'run in the background')
    .option('--strict-port', 'fail if the preferred port is unavailable')
    .option('--log <path>', 'background log file', DEFAULT_LOG_FILE);
}

// Browser-open policy:
//   - foreground: open by default; --no-open disables.
//   - background: never auto-open. Use `ccgauge open` after start.
function shouldOpenBrowser(opts) {
  if (opts.background) return false;
  return opts.open !== false;
}

// For `restart`: when the user did not explicitly pass an option, fall back
// to whatever the previous background run was using.
async function inheritFromState(opts, cmd) {
  const prev = await readState();
  if (!prev) return { ...opts };
  const isDefault = (key) => cmd.getOptionValueSource(key) === 'default';
  const merged = { ...opts };
  if (isDefault('port') && prev.port) merged.port = String(prev.port);
  if (isDefault('host') && prev.host) merged.host = prev.host;
  if (isDefault('log') && prev.logFile) merged.log = prev.logFile;
  if (!opts.dir && prev.dataDir) merged.dir = prev.dataDir;
  return merged;
}

const program = new Command();
program
  .name('ccgauge')
  .description(pkg.description ?? 'Local Usage Dashboard')
  .version(pkg.version ?? '0.0.0');

addStartOptions(program.command('start').description('start the dashboard'))
  .action(async (opts) => {
    await start(opts);
  });

program
  .command('stop')
  .description('stop a background dashboard')
  .option('--force', 'force kill the background process')
  .action(async (opts) => {
    await stop({ force: opts.force, verbose: true });
  });

addStartOptions(program.command('restart').description('restart the background dashboard'))
  .action(async (opts, cmd) => {
    const merged = await inheritFromState(opts, cmd);
    await stop({ force: false, verbose: false });
    await start({ ...merged, background: true });
  });

program
  .command('status')
  .description('show background dashboard status')
  .option('--json', 'print machine-readable JSON')
  .action(async (opts) => {
    await status(opts);
  });

program
  .command('open')
  .description('open the running background dashboard')
  .action(async () => {
    await openRunningDashboard();
  });

program
  .command('logs')
  .description('show background dashboard logs')
  .option('-f, --follow', 'follow log output')
  .option('-n, --lines <lines>', 'number of lines to show', '80')
  .action(async (opts) => {
    await logs(opts);
  });

await program.parseAsync(normalizeArgv(process.argv));

function normalizeArgv(argv) {
  const args = argv.slice(2);
  if (args.includes('--help') || args.includes('-h') || args.includes('-V') || args.includes('--version')) {
    return argv;
  }
  if (hasSubcommand(args)) return argv;
  return [argv[0], argv[1], 'start', ...args];
}

function hasSubcommand(args) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--') break;
    if (COMMAND_NAMES.has(arg)) return true;
    if (VALUE_OPTIONS.has(arg)) i += 1;
  }
  return false;
}

async function start(opts) {
  const standaloneEntry = assertStandaloneEntry();
  const background = Boolean(opts.background);
  if (background) {
    await startBackground(standaloneEntry, opts);
    return;
  }
  await startForeground(standaloneEntry, opts);
}

async function startForeground(standaloneEntry, opts) {
  const port = await resolvePort(opts);
  const env = makeServerEnv(opts, port);
  const child = fork(standaloneEntry, [], {
    cwd: dirname(standaloneEntry),
    env,
    stdio: opts.quiet ? ['ignore', 'ignore', 'inherit', 'ipc'] : 'inherit',
  });

  const url = buildUrl(opts.host, port);
  waitForUrl(url, 15_000)
    .then(async () => {
      if (shouldOpenBrowser(opts)) await tryOpen(url);
      printReady(url, { background: false });
    })
    .catch((err) => {
      console.error(`\n[ccgauge] failed to start: ${err.message}\n`);
      safeKill(child.pid, 'SIGTERM');
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
}

async function startBackground(standaloneEntry, opts) {
  const existing = await readState();
  if (existing && isProcessRunning(existing.pid)) {
    printAlreadyRunning(existing);
    return;
  }
  if (existing) await removeState();

  await ensureStateDir();
  const port = await resolvePort(opts);
  const env = makeServerEnv(opts, port);
  const logFile = resolve(String(opts.log || DEFAULT_LOG_FILE));
  await mkdir(dirname(logFile), { recursive: true });
  const out = openSync(logFile, 'a');
  const err = openSync(logFile, 'a');
  const child = spawn(process.execPath, [standaloneEntry], {
    cwd: dirname(standaloneEntry),
    env,
    detached: true,
    stdio: ['ignore', out, err],
  });
  child.unref();
  // Once spawn() has dup'd these fds into the child, the parent can release them.
  try { closeSync(out); } catch { /* ignore */ }
  try { closeSync(err); } catch { /* ignore */ }

  const url = buildUrl(opts.host, port);
  try {
    await waitForUrl(url, 15_000);
  } catch (startErr) {
    if (isProcessRunning(child.pid)) {
      safeKill(child.pid, 'SIGTERM');
      const exited = await waitForProcessExit(child.pid, 2_000);
      if (!exited) safeKill(child.pid, 'SIGKILL');
    }
    throw new Error(`failed to start background service: ${startErr.message}`);
  }

  await writeState({
    pid: child.pid,
    port,
    host: opts.host,
    url,
    logFile,
    startedAt: new Date().toISOString(),
    packageRoot,
    dataDir: opts.dir ? String(opts.dir) : null,
  });
  printReady(url, { background: true, logFile, pid: child.pid });
}

async function stop({ force = false, verbose = true } = {}) {
  const state = await readState();
  if (!state) {
    if (verbose) console.log('[ccgauge] no background service state found');
    return false;
  }
  if (!isProcessRunning(state.pid)) {
    await removeState();
    if (verbose) console.log('[ccgauge] background service is not running; cleaned stale state');
    return false;
  }

  safeKill(state.pid, force ? 'SIGKILL' : 'SIGTERM');
  const stopped = await waitForProcessExit(state.pid, force ? 2_000 : 6_000);
  if (!stopped && !force) {
    safeKill(state.pid, 'SIGKILL');
    await waitForProcessExit(state.pid, 2_000);
  }
  await removeState();
  if (verbose) console.log(`[ccgauge] stopped background service (pid ${state.pid})`);
  return true;
}

async function status(opts) {
  const state = await readState();
  const running = !!state && isProcessRunning(state.pid);
  if (state && !running) await removeState();

  const payload = state
    ? { running, ...state }
    : { running: false };
  if (opts.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  if (!running) {
    console.log('ccgauge is not running');
    return;
  }
  console.log([
    'ccgauge is running',
    `URL: ${state.url}`,
    `PID: ${state.pid}`,
    `Started: ${state.startedAt}`,
    `Log: ${state.logFile}`,
  ].join('\n'));
}

async function openRunningDashboard() {
  const state = await readState();
  if (!state || !isProcessRunning(state.pid)) {
    if (state) await removeState();
    console.error('[ccgauge] background service is not running');
    process.exit(1);
  }
  await tryOpen(state.url);
  console.log(`[ccgauge] opened ${state.url}`);
}

async function logs(opts) {
  const state = await readState();
  const logFile = state?.logFile || DEFAULT_LOG_FILE;
  if (!existsSync(logFile)) {
    console.error(`[ccgauge] log file not found: ${logFile}`);
    process.exit(1);
  }
  const lines = Math.max(1, parseInt(String(opts.lines), 10) || 80);
  const content = await readFile(logFile, 'utf8');
  const tail = content.split(/\r?\n/).slice(-lines).join('\n');
  if (tail.trim()) process.stdout.write(tail.endsWith('\n') ? tail : tail + '\n');
  if (!opts.follow) return;
  await followLog(logFile, content.length);
}

function assertStandaloneEntry() {
  const standaloneEntry = join(packageRoot, '.next', 'standalone', 'server.js');
  if (existsSync(standaloneEntry)) return standaloneEntry;
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

async function resolvePort(opts) {
  const preferred = parseInt(String(opts.port), 10);
  if (!Number.isInteger(preferred) || preferred <= 0 || preferred > 65535) {
    throw new Error(`invalid port: ${opts.port}`);
  }
  const candidates = opts.strictPort
    ? preferred
    : [preferred, ...Array.from({ length: 19 }, (_, i) => preferred + i + 1).filter((p) => p <= 65535), 0];
  const port = await getPort({ port: candidates });
  if (opts.strictPort && port !== preferred) {
    throw new Error(`port ${preferred} is already in use`);
  }
  return port;
}

function makeServerEnv(opts, port) {
  const env = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: opts.host,
    NODE_ENV: 'production',
  };
  if (opts.dir) {
    env.CCGAUGE_CONFIG_DIR = String(opts.dir);
  }
  return env;
}

async function waitForUrl(target, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(target, {
        method: 'HEAD',
        signal: AbortSignal.timeout(500),
      });
      if (res.status < 500) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw lastErr ?? new Error('server did not start in time');
}

async function tryOpen(url) {
  try {
    await openBrowser(url);
  } catch {
    // ignore — user may be on remote without a browser
  }
}

function printReady(url, opts = {}) {
  const banner = [
    '',
    '  \x1b[1m\x1b[38;2;201;100;66mccgauge\x1b[0m  Local Usage Dashboard',
    '',
    `   ➜  Local:   \x1b[36m${url}\x1b[0m`,
    opts.background
      ? `   ➜  PID:     \x1b[2m${opts.pid}\x1b[0m`
      : `   ➜  Press \x1b[2mCtrl+C\x1b[0m to stop`,
    opts.background
      ? `   ➜  Log:     \x1b[2m${opts.logFile}\x1b[0m`
      : '',
    opts.background
      ? `   ➜  Stop:    \x1b[2mccgauge stop\x1b[0m`
      : '',
    '',
  ].filter(Boolean).join('\n');
  process.stdout.write(banner + '\n');
}

function printAlreadyRunning(state) {
  console.log([
    'ccgauge is already running',
    `URL: ${state.url}`,
    `PID: ${state.pid}`,
    `Stop: ccgauge stop`,
  ].join('\n'));
}

async function ensureStateDir() {
  await mkdir(STATE_DIR, { recursive: true });
}

async function readState() {
  try {
    const raw = await readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    // Treat unknown / future versions as stale (auto-clean on next stop/start).
    if (parsed.version !== STATE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeState(state) {
  await ensureStateDir();
  const payload = { version: STATE_VERSION, ...state };
  await writeFile(STATE_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

async function removeState() {
  await rm(STATE_FILE, { force: true });
}

function isProcessRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForProcessExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessRunning(pid)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return !isProcessRunning(pid);
}

async function followLog(logFile, offset) {
  let cursor = offset;
  let busy = false;
  console.log('[ccgauge] following logs; press Ctrl+C to stop');
  await new Promise((resolveFollow) => {
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      clearInterval(id);
      resolveFollow();
    };
    const id = setInterval(async () => {
      if (busy || done) return;
      busy = true;
      try {
        const s = await stat(logFile);
        if (s.size < cursor) cursor = 0; // log was truncated / rotated
        if (s.size === cursor) return;
        await new Promise((res, rej) => {
          const stream = createReadStream(logFile, { start: cursor, encoding: 'utf8' });
          stream.on('data', (chunk) => process.stdout.write(chunk));
          stream.on('end', () => {
            cursor = s.size;
            res();
          });
          stream.on('error', rej);
        });
      } catch {
        // keep following unless interrupted
      } finally {
        busy = false;
      }
    }, 1000);
    process.on('SIGINT', cleanup);
  });
}
