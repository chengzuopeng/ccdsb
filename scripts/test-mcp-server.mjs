#!/usr/bin/env node
// Smoke test: spawn the bundled MCP server, run an init handshake +
// tools/list + a few tools/call round-trips, assert the basics.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const root = dirname(dirname(__filename));
const bundle = resolve(root, 'dist/mcp/server.mjs');

if (!existsSync(bundle)) {
  console.error(`bundle missing: ${bundle}\nrun: pnpm build:mcp`);
  process.exit(1);
}

const child = spawn(process.execPath, [bundle], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env },
});

let buf = '';
const pending = new Map();
let nextId = 1;

child.stdout.on('data', (chunk) => {
  buf += chunk.toString('utf8');
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id != null && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});
child.stderr.on('data', (chunk) => {
  process.stderr.write('[server] ' + chunk.toString('utf8'));
});
child.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`server exited with code ${code}`);
    process.exit(1);
  }
});

// Surface unexpected JSON-RPC notifications (e.g. server-side errors)
// for easier debugging.

function rpc(method, params) {
  const id = nextId++;
  const req = { jsonrpc: '2.0', id, method, params };
  child.stdin.write(JSON.stringify(req) + '\n');
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`rpc timeout: ${method}`));
    }, 30_000);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      if (msg.error) reject(new Error(`rpc error ${method}: ${JSON.stringify(msg.error)}`));
      else resolve(msg.result);
    });
  });
}

function shutdown(code = 0) {
  try {
    child.stdin.end();
  } catch { /* ignore */ }
  setTimeout(() => process.exit(code), 250);
}

try {
  // 1) initialize
  const initRes = await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'ccgauge-smoke-test', version: '0.0.0' },
  });
  assert.equal(initRes.serverInfo?.name, 'ccgauge', 'serverInfo.name');
  console.log(`init OK · server=${initRes.serverInfo.name}@${initRes.serverInfo.version}`);

  // initialized notification (no response)
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  // 2) tools/list
  const list = await rpc('tools/list', {});
  const toolNames = list.tools.map((t) => t.name).sort();
  console.log(`tools (${toolNames.length}): ${toolNames.join(', ')}`);
  for (const expected of [
    'usage_summary',
    'usage_by_time',
    'usage_by_model',
    'usage_by_project',
    'usage_by_session',
    'daily_summary',
    'weekly_summary',
    'recent_activity',
  ]) {
    assert.ok(toolNames.includes(expected), `missing tool ${expected}`);
  }

  // 3) resources/list
  const resList = await rpc('resources/list', {});
  const resUris = resList.resources.map((r) => r.uri);
  console.log(`resources: ${resUris.join(', ')}`);
  assert.ok(resUris.includes('ccgauge://providers'), 'missing providers resource');

  // 4) call usage_summary (default args = source=all, range=all)
  const sum = await rpc('tools/call', {
    name: 'usage_summary',
    arguments: {},
  });
  const sumPayload = JSON.parse(sum.content[0].text);
  assert.ok(sumPayload.totals, 'totals missing');
  assert.ok(sumPayload.bySource, 'bySource missing');
  assert.ok(sumPayload.bySource.claude, 'bySource.claude missing');
  assert.ok(sumPayload.bySource.codex, 'bySource.codex missing');
  console.log(
    `usage_summary OK · total=${sumPayload.totals.total_tokens.toLocaleString()} tokens, $${sumPayload.totals.cost_usd.toFixed(2)} (claude=$${sumPayload.bySource.claude.cost_usd.toFixed(2)} + codex=$${sumPayload.bySource.codex.cost_usd.toFixed(2)})`,
  );

  // 5) call daily_summary (today, source=all)
  const day = await rpc('tools/call', {
    name: 'daily_summary',
    arguments: { date: 'today' },
  });
  const dayPayload = JSON.parse(day.content[0].text);
  assert.equal(dayPayload.date, 'today');
  assert.ok(dayPayload.bySource, 'bySource missing');
  assert.ok(Array.isArray(dayPayload.sessions_by_project), 'sessions_by_project missing');
  console.log(
    `daily_summary OK · sessions=${dayPayload.session_count} cost=$${dayPayload.totals.cost_usd.toFixed(2)} projects=${dayPayload.sessions_by_project.length}`,
  );

  // 6) call usage_by_model with source=codex (single source path)
  const byModel = await rpc('tools/call', {
    name: 'usage_by_model',
    arguments: { range: '30d', source: 'codex', limit: 5 },
  });
  const byModelPayload = JSON.parse(byModel.content[0].text);
  assert.equal(byModelPayload.source, 'codex');
  for (const m of byModelPayload.models) {
    assert.equal(m.source, 'codex', `model entry source should be codex, got ${m.source}`);
  }
  console.log(
    `usage_by_model OK · models=${byModelPayload.models.length} top=${byModelPayload.models[0]?.model ?? '—'}`,
  );

  // 7) call weekly_summary
  const week = await rpc('tools/call', {
    name: 'weekly_summary',
    arguments: { week_offset: 0 },
  });
  const weekPayload = JSON.parse(week.content[0].text);
  assert.equal(weekPayload.per_day.length, 7, 'weekly should have 7 day buckets');
  console.log(
    `weekly_summary OK · ${weekPayload.week} sessions=${weekPayload.session_count} cost=$${weekPayload.totals.cost_usd.toFixed(2)}`,
  );

  // 8) read providers resource
  const providers = await rpc('resources/read', { uri: 'ccgauge://providers' });
  const provPayload = JSON.parse(providers.contents[0].text);
  assert.ok(Array.isArray(provPayload.providers), 'providers list missing');
  console.log(
    `providers resource OK · ${provPayload.providers.map((p) => `${p.id}(${p.assistant_records}rec)`).join(' ')}`,
  );

  // ── regression coverage for the three review fixes ────────────────────

  // 9) top_tools must respect `source` (review #1)
  // Daily summaries against codex vs claude must NOT return identical
  // top_tools — otherwise we're mixing provider tool-call stats together.
  const dayCodex = await rpc('tools/call', {
    name: 'daily_summary',
    arguments: { date: 'today', source: 'codex' },
  });
  const dayClaude = await rpc('tools/call', {
    name: 'daily_summary',
    arguments: { date: 'today', source: 'claude' },
  });
  const codexTools = JSON.parse(dayCodex.content[0].text).top_tools;
  const claudeTools = JSON.parse(dayClaude.content[0].text).top_tools;
  // Equal arrays would only happen by coincidence (e.g. both empty). If
  // either side has any tools, the lists shouldn't be identical to "all".
  const dayAll = await rpc('tools/call', {
    name: 'daily_summary',
    arguments: { date: 'today', source: 'all' },
  });
  const allTools = JSON.parse(dayAll.content[0].text).top_tools;
  if (codexTools.length > 0 || claudeTools.length > 0) {
    assert.notDeepStrictEqual(
      codexTools,
      allTools,
      'top_tools(codex) should not equal top_tools(all) when codex/claude differ',
    );
  }
  console.log(
    `top_tools source filter OK · codex=${codexTools.length} claude=${claudeTools.length} all=${allTools.length}`,
  );

  // 10) usage_by_time must surface reasoning_tokens per bucket (review #2)
  const byTime = await rpc('tools/call', {
    name: 'usage_by_time',
    arguments: { range: 'all', source: 'codex', granularity: 'month' },
  });
  const byTimePayload = JSON.parse(byTime.content[0].text);
  const bucketReasoningSum = byTimePayload.buckets.reduce(
    (acc, b) => acc + (b.totals.reasoning_tokens ?? 0),
    0,
  );
  // Cross-check: usage_summary for the same window should report the same
  // reasoning total. If buckets sum to 0 but the summary shows a nonzero
  // figure, the bug is back.
  const allCodex = await rpc('tools/call', {
    name: 'usage_summary',
    arguments: { range: 'all', source: 'codex' },
  });
  const summaryReasoning = JSON.parse(allCodex.content[0].text).totals.reasoning_tokens;
  if (summaryReasoning > 0) {
    assert.ok(
      bucketReasoningSum > 0,
      `usage_by_time should propagate reasoning_tokens (got 0 across all buckets, but usage_summary has ${summaryReasoning})`,
    );
    // Allow small drift if a record sits exactly on a bucket boundary;
    // require the bucket sum to be at least 95% of the summary figure.
    assert.ok(
      bucketReasoningSum >= summaryReasoning * 0.95,
      `bucket reasoning sum (${bucketReasoningSum}) too far below summary (${summaryReasoning})`,
    );
  }
  console.log(
    `usage_by_time reasoning OK · summary=${summaryReasoning.toLocaleString()} buckets=${bucketReasoningSum.toLocaleString()}`,
  );

  // 11) Invalid range / from / to must error, not silently fall back to all-time (review #3)
  // The MCP SDK turns thrown errors into a tool-result with isError=true
  // (per spec) rather than a JSON-RPC error. We treat both as "rejected".
  function isRejected(result) {
    if (!result) return false;
    if (result.isError) return true;
    // Some SDKs put the error message in content[0].text with type="text"
    const txt = result.content?.[0]?.text;
    if (typeof txt === 'string' && /invalid|error|rejected/i.test(txt)) return true;
    return false;
  }
  async function expectRejected(method, params, label) {
    let result;
    let threw = false;
    try {
      result = await rpc(method, params);
    } catch {
      threw = true;
    }
    if (threw) return; // JSON-RPC error path
    assert.ok(
      isRejected(result),
      `${label} should be rejected; got ${JSON.stringify(result).slice(0, 300)}`,
    );
  }

  await expectRejected(
    'tools/call',
    { name: 'usage_summary', arguments: { range: 'last_decade' } },
    'invalid range "last_decade"',
  );

  await expectRejected(
    'tools/call',
    { name: 'usage_summary', arguments: { from: 'definitely-not-a-date' } },
    'invalid from "definitely-not-a-date"',
  );
  await expectRejected(
    'tools/call',
    { name: 'daily_summary', arguments: { date: 'someday' } },
    'invalid daily_summary date "someday"',
  );
  console.log('strict validation OK · invalid range/from/date all rejected');

  console.log('\nAll MCP smoke assertions passed.');
  shutdown(0);
} catch (e) {
  console.error('SMOKE TEST FAILED:', e);
  shutdown(1);
}
