import { NextResponse } from 'next/server';
import os from 'node:os';

type RouteHandler = (req: Request, ctx?: unknown) => Promise<Response> | Response;

interface ApiError {
  error: string;
  message: string;
  /** Stable code for the client to switch on. */
  code?: string;
}

const HOME = os.homedir();

/** Strip absolute paths (which can contain the OS username) from error
 *  messages bubbled out to the client. */
function sanitizeMessage(msg: string): string {
  if (!HOME) return msg;
  const escaped = HOME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return msg.replace(new RegExp(escaped, 'g'), '~');
}

/**
 * Wrap a Next.js route handler so any thrown error is converted into a
 * structured JSON `500` response with a sanitized message. The full stack
 * trace stays in the server log; the client only sees the public message.
 *
 * Usage:
 *   export const GET = withApiErrorHandling(async (req) => { ... });
 */
export function withApiErrorHandling<T extends RouteHandler>(handler: T): T {
  const wrapped = async (req: Request, ctx?: unknown): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      const e = err as Error;
      const stack = e.stack || e.message || String(e);
      // Server-side: full diagnostic in the log.
      console.error('[ccgauge:api] handler threw', stack);
      const body: ApiError = {
        error: 'internal_error',
        message: sanitizeMessage(e.message || 'unexpected server error'),
      };
      return NextResponse.json(body, { status: 500 });
    }
  };
  return wrapped as T;
}

export function badRequest(message: string, code = 'bad_request'): Response {
  const body: ApiError = {
    error: 'bad_request',
    code,
    message: sanitizeMessage(message),
  };
  return NextResponse.json(body, { status: 400 });
}
