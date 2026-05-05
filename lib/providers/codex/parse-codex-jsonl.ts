import { createReadStream } from 'node:fs';
import readline from 'node:readline';
import type { AssistantRecord, UserRecord } from '@/lib/types';
import type { ParsedFile } from '../types';

const TEXT_PREVIEW_MAX = 200;

interface CodexEvent {
  timestamp?: string;
  type?: string;
  payload?: Record<string, unknown> | null;
}

interface TurnState {
  turnId: string | null;
  cwd: string;
  model: string;
  effort?: string;
  userUuid: string | null;
  toolNames: string[];
  hasThinking: boolean;
  pendingTextPreview: string;
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function extractMessageText(payload: Record<string, unknown>): string {
  const msg = payload.message;
  if (typeof msg === 'string') return msg;
  const content = payload.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    for (const c of content as Array<Record<string, unknown>>) {
      const t = c?.type;
      if ((t === 'input_text' || t === 'output_text' || t === 'text') && typeof c.text === 'string') {
        return c.text;
      }
    }
  }
  return '';
}

export async function parseCodexJsonlFile(file: string): Promise<ParsedFile> {
  const stream = createReadStream(file, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  const assistant: AssistantRecord[] = [];
  const user: UserRecord[] = [];
  const parentLinks: Array<[string, string | null]> = [];

  let sessionId = '';
  let cliVersion: string | undefined;
  let defaultCwd = '';
  let userIdx = 0;
  let assistantIdx = 0;

  const turn: TurnState = {
    turnId: null,
    cwd: '',
    model: 'gpt-unknown',
    userUuid: null,
    toolNames: [],
    hasThinking: false,
    pendingTextPreview: '',
  };

  for await (const line of rl) {
    if (!line.trim()) continue;
    let evt: CodexEvent;
    try {
      evt = JSON.parse(line) as CodexEvent;
    } catch {
      continue;
    }
    if (!evt || typeof evt !== 'object' || !evt.type) continue;
    const payload = (evt.payload ?? {}) as Record<string, unknown>;
    const ts = asString(evt.timestamp);

    if (evt.type === 'session_meta') {
      sessionId = asString(payload.id);
      defaultCwd = asString(payload.cwd);
      cliVersion = asString(payload.cli_version) || undefined;
      if (!turn.cwd) turn.cwd = defaultCwd;
      continue;
    }

    if (evt.type === 'turn_context') {
      turn.turnId = asString(payload.turn_id) || turn.turnId;
      turn.cwd = asString(payload.cwd) || defaultCwd;
      const m = asString(payload.model);
      if (m) turn.model = m;
      const eff = asString(payload.effort);
      if (eff) turn.effort = eff;
      turn.toolNames = [];
      turn.hasThinking = false;
      turn.pendingTextPreview = '';
      continue;
    }

    if (evt.type === 'event_msg') {
      const sub = asString(payload.type);

      if (sub === 'user_message') {
        const text = extractMessageText(payload);
        if (!text) continue;
        const uuid = `${sessionId}::u${userIdx++}`;
        user.push({
          type: 'user',
          source: 'codex',
          uuid,
          parentUuid: null,
          timestamp: ts,
          sessionId,
          cwd: turn.cwd || defaultCwd,
          textPreview: text.slice(0, TEXT_PREVIEW_MAX),
          filePath: file,
        });
        parentLinks.push([uuid, null]);
        turn.userUuid = uuid;
        continue;
      }

      if (sub === 'agent_message') {
        const text = extractMessageText(payload);
        if (text && !turn.pendingTextPreview) {
          turn.pendingTextPreview = text.slice(0, TEXT_PREVIEW_MAX);
        }
        continue;
      }

      if (sub === 'agent_reasoning') {
        turn.hasThinking = true;
        continue;
      }

      if (sub === 'token_count') {
        const info = payload.info as Record<string, unknown> | null | undefined;
        if (!info) continue;
        const last = info.last_token_usage as Record<string, unknown> | undefined;
        if (!last) continue;
        const cached = asNumber(last.cached_input_tokens);
        const rawInput = asNumber(last.input_tokens);
        const output = asNumber(last.output_tokens);
        const reasoning = asNumber(last.reasoning_output_tokens);

        const uuid = `${sessionId}::a${assistantIdx++}`;
        const requestId = turn.turnId
          ? `${turn.turnId}::a${assistantIdx}`
          : `${sessionId}::a${assistantIdx}`;

        assistant.push({
          type: 'assistant',
          source: 'codex',
          uuid,
          parentUuid: turn.userUuid,
          timestamp: ts,
          sessionId,
          requestId,
          cwd: turn.cwd || defaultCwd,
          version: cliVersion,
          model: turn.model || 'gpt-unknown',
          messageId: requestId,
          usage: {
            input_tokens: Math.max(0, rawInput - cached),
            output_tokens: output + reasoning,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: cached,
            cache_creation_5m: 0,
            cache_creation_1h: 0,
          },
          toolNames: [...turn.toolNames],
          hasThinking: turn.hasThinking,
          textPreview: turn.pendingTextPreview,
          filePath: file,
        });
        parentLinks.push([uuid, turn.userUuid]);

        turn.toolNames = [];
        turn.hasThinking = false;
        turn.pendingTextPreview = '';
        continue;
      }
      continue;
    }

    if (evt.type === 'response_item') {
      const sub = asString(payload.type);

      if (sub === 'function_call' || sub === 'custom_tool_call') {
        const name = asString(payload.name);
        if (name) turn.toolNames.push(name);
        continue;
      }

      if (sub === 'reasoning') {
        turn.hasThinking = true;
        continue;
      }

      if (sub === 'message') {
        const role = asString(payload.role);
        if (role === 'assistant') {
          const text = extractMessageText(payload);
          if (text && !turn.pendingTextPreview) {
            turn.pendingTextPreview = text.slice(0, TEXT_PREVIEW_MAX);
          }
        }
        continue;
      }
      continue;
    }
  }

  return { assistant, user, parentLinks };
}
