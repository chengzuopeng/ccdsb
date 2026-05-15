import { createReadStream } from 'node:fs';
import readline from 'node:readline';
import type { AssistantRecord, RawRecord, UserRecord } from '../types';

const TEXT_PREVIEW_MAX = 200;

export async function parseJsonlFile(file: string): Promise<{
  assistant: AssistantRecord[];
  user: UserRecord[];
  parentLinks: Array<[string, string | null]>;
}> {
  const stream = createReadStream(file, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const assistant: AssistantRecord[] = [];
  const user: UserRecord[] = [];
  const parentLinks: Array<[string, string | null]> = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    let raw: RawRecord;
    try {
      raw = JSON.parse(line) as RawRecord;
    } catch {
      continue;
    }
    if (!raw || typeof raw !== 'object') continue;

    if (raw.uuid) parentLinks.push([raw.uuid, raw.parentUuid ?? null]);

    if (raw.type === 'assistant') {
      const a = parseAssistant(raw, file);
      if (a) assistant.push(a);
    } else if (raw.type === 'user') {
      const u = parseUser(raw, file);
      if (u) user.push(u);
    }
  }

  return { assistant, user, parentLinks };
}

function parseAssistant(raw: RawRecord, file: string): AssistantRecord | null {
  const msg = raw.message as Record<string, unknown> | undefined;
  if (!msg) return null;
  const usage = msg.usage as Record<string, number> | undefined;
  if (!usage) return null;
  const model = (msg.model as string | undefined) ?? '';
  if (!model || model === '<synthetic>') return null;
  const messageId = (msg.id as string | undefined) ?? raw.uuid ?? '';
  if (!messageId && !raw.requestId) return null;

  const cacheCreation = (usage.cache_creation as unknown) as
    | { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number }
    | undefined;

  const content = Array.isArray(msg.content) ? (msg.content as Array<Record<string, unknown>>) : [];
  const toolNames: string[] = [];
  let hasThinking = false;
  let textPreview = '';
  for (const c of content) {
    if (c.type === 'tool_use' && typeof c.name === 'string') {
      toolNames.push(c.name);
    } else if (c.type === 'thinking') {
      hasThinking = true;
    } else if (c.type === 'text' && typeof c.text === 'string' && !textPreview) {
      textPreview = (c.text as string).slice(0, TEXT_PREVIEW_MAX);
    }
  }

  return {
    type: 'assistant',
    source: 'claude',
    uuid: raw.uuid ?? messageId,
    parentUuid: raw.parentUuid ?? null,
    timestamp: raw.timestamp ?? new Date().toISOString(),
    sessionId: raw.sessionId ?? '',
    requestId: raw.requestId ?? '',
    cwd: raw.cwd ?? '',
    gitBranch: raw.gitBranch,
    version: raw.version,
    model,
    messageId,
    usage: {
      input_tokens: Number(usage.input_tokens) || 0,
      output_tokens: Number(usage.output_tokens) || 0,
      cache_creation_input_tokens: Number(usage.cache_creation_input_tokens) || 0,
      cache_read_input_tokens: Number(usage.cache_read_input_tokens) || 0,
      cache_creation_5m: Number(cacheCreation?.ephemeral_5m_input_tokens) || 0,
      cache_creation_1h: Number(cacheCreation?.ephemeral_1h_input_tokens) || 0,
    },
    toolNames,
    hasThinking,
    textPreview,
    filePath: file,
    isSidechain: raw.isSidechain === true ? true : undefined,
  };
}

function parseUser(raw: RawRecord, file: string): UserRecord | null {
  if (!raw.uuid) return null;
  const msg = raw.message as Record<string, unknown> | undefined;
  let textPreview = '';
  if (msg) {
    const content = msg.content;
    if (typeof content === 'string') {
      textPreview = content.slice(0, TEXT_PREVIEW_MAX);
    } else if (Array.isArray(content)) {
      for (const c of content as Array<Record<string, unknown>>) {
        if (c.type === 'text' && typeof c.text === 'string') {
          textPreview = (c.text as string).slice(0, TEXT_PREVIEW_MAX);
          break;
        }
      }
    }
  }

  // Synthetic / system-injected user messages — Claude Code occasionally
  // writes text-bearing user records that didn't come from the human:
  //   1. skill metadata loaded mid-turn / <system-reminder> blocks (text-based
  //      detection via `isSyntheticUserText`);
  //   2. sub-agent invocation prompts — every record in a `subagents/agent-*.jsonl`
  //      file has `isSidechain: true`, and the first user record there is the
  //      programmatic prompt the parent agent gave the sub-agent. Treating it
  //      as a turn root wrongly splits one human prompt into two table rows.
  // We keep their textPreview so child rows in the usage table can still show
  // "Skill: mf-commit ..." / "Working dir: ..." as a per-call prompt, but
  // flag them so the turn-grouping logic walks past them when looking for
  // a real turn root.
  const isSidechain = raw.isSidechain === true;
  const isSynthetic = isSidechain || (!!textPreview && isSyntheticUserText(textPreview));

  return {
    type: 'user',
    source: 'claude',
    uuid: raw.uuid,
    parentUuid: raw.parentUuid ?? null,
    timestamp: raw.timestamp ?? new Date().toISOString(),
    sessionId: raw.sessionId ?? '',
    cwd: raw.cwd ?? '',
    textPreview,
    isSynthetic,
    isSidechain: isSidechain ? true : undefined,
    filePath: file,
  };
}

/**
 * Returns true if `text` looks like a system-injected user message rather than
 * actual human input. Keep this conservative: only patterns we have high
 * confidence are non-human go in here.
 */
export function isSyntheticUserText(text: string): boolean {
  const t = text.trimStart();
  // Skill metadata loaded mid-conversation when Claude calls the Skill tool.
  if (t.startsWith('Base directory for this skill:')) return true;
  // System-reminder blocks (e.g. "TodoWrite hasn't been used recently",
  // auto-mode banners, deferred-tool announcements).
  if (t.startsWith('<system-reminder>')) return true;
  // The "Caveat: the messages below were generated by a tool" prelude that
  // sometimes wraps tool-result follow-ups.
  if (t.startsWith('Caveat: The messages below were generated by')) return true;
  return false;
}
