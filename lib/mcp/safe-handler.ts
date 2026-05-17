import { sanitizeForUser } from '@/lib/sanitize';

/** Wrap an MCP tool handler so any thrown error has its message scrubbed
 *  of `$HOME` paths before it reaches the SDK's error envelope (and from
 *  there the LLM transcript, the client's logs, and possibly bug reports
 *  filed elsewhere).
 *
 *  Today the only sites that throw user-visible errors are date-arg
 *  validators with clean messages, so this is belt-and-suspenders — but
 *  any future error path that wraps an indexer error or a parser error
 *  will potentially carry absolute paths, and we'd rather not have to
 *  remember to scrub them at every throw site. */
export function safeMcpHandler<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
): (args: TArgs) => Promise<TResult> {
  return async (args) => {
    try {
      return await fn(args);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const scrubbed = sanitizeForUser(raw);
      // Preserve the original prototype so `err instanceof Error` checks
      // upstream still work; only the message changes.
      if (err instanceof Error && scrubbed !== raw) {
        err.message = scrubbed;
      }
      throw err;
    }
  };
}
