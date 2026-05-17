import { homedir } from 'node:os';

/** Replace the user's `$HOME` prefix with `~` in any string. Used to
 *  scrub error messages and other user-visible text before it crosses
 *  a process boundary (API response, MCP tool result transcript,
 *  Settings UI), so absolute paths like
 *  `/Users/jdoe/.codex/sessions/...` don't leak the OS username.
 *
 *  Windows nuance: `homedir()` returns `C:\Users\<name>` (backslashes),
 *  but the same path can appear in error strings as:
 *    - forward-slashed (Node APIs frequently normalize):  `C:/Users/<name>/...`
 *    - JSON-escaped (when nested in a serialized payload): `C:\\Users\\<name>\\...`
 *    - long-path prefixed:                                 `\\?\C:\Users\<name>\...`
 *  We strip every variant we can synthesize from `homedir()` so users
 *  on Windows get the same privacy guarantee as macOS / Linux. */
export function sanitizeForUser(s: string): string {
  const home = homedir();
  if (!home) return s;

  // Build the set of literal substrings to replace. `Set` dedupes the
  // macOS / Linux case where every variant collapses back to `home`.
  const variants = new Set<string>([home]);
  if (process.platform === 'win32') {
    // Forward-slashed (e.g. errors from `path.posix` / certain Node APIs).
    variants.add(home.replace(/\\/g, '/'));
    // JSON-escaped (when the path was embedded in a JSON string that got
    // re-stringified — backslash doubles up).
    variants.add(home.replace(/\\/g, '\\\\'));
    // Long-path / extended-length prefix.
    variants.add('\\\\?\\' + home);
    variants.add('\\\\?\\' + home.replace(/\\/g, '/'));
  }

  let out = s;
  for (const v of variants) {
    // Escape regex special chars per variant (the home path itself only
    // contains backslashes/slashes/colons, but the long-path prefix has
    // `\\?\` which absolutely needs escaping).
    const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(escaped, 'g'), '~');
  }
  return out;
}
