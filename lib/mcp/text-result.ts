/** Shared helper that wraps an arbitrary JSON payload in the MCP
 *  `tools/call` response shape (`{ content: [{ type: 'text', text }] }`).
 *
 *  Pretty-printed indent (`null, 2`) is OFF by default — LLMs don't read
 *  whitespace but pay for it as input tokens, and our heavier responses
 *  (`weekly_summary`, `usage_by_session`) can run 10–30 KB easily, so
 *  halving the byte count directly halves the calling LLM's context cost.
 *  Set `CCGAUGE_MCP_PRETTY=1` to re-enable for dev / debugging. */
const PRETTY = process.env.CCGAUGE_MCP_PRETTY === '1';

export function asTextResult(payload: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: PRETTY ? JSON.stringify(payload, null, 2) : JSON.stringify(payload),
      },
    ],
  };
}
