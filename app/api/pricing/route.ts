import { NextResponse } from 'next/server';
import { BUILTIN_PRICING } from '@/lib/pricing/builtin';
import { BUILTIN_PRICING_OPENAI } from '@/lib/providers/codex/pricing';
import { resolveSource } from '@/lib/source';
import type { Pricing } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const source = await resolveSource(url.searchParams.get('source'));
  const pricing: Record<string, Pricing> =
    source === 'codex' ? BUILTIN_PRICING_OPENAI : BUILTIN_PRICING;
  return NextResponse.json({ source, pricing, source_kind: 'builtin' });
}
