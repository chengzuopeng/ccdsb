import { homedir } from 'node:os';

/** Replace the user's `$HOME` prefix with `~` in any string. Used to
 *  scrub error messages and other user-visible text before it crosses
 *  a process boundary (API response, MCP tool result transcript,
 *  Settings UI), so absolute paths like
 *  `/Users/jdoe/.codex/sessions/...` don't leak the OS username. */
export function sanitizeForUser(s: string): string {
  const home = homedir();
  if (!home) return s;
  // Escape regex special chars in the home path.
  const escaped = home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return s.replace(new RegExp(escaped, 'g'), '~');
}
