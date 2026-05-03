import { NextResponse } from 'next/server';
import { BUILTIN_PRICING } from '@/lib/pricing/builtin';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ pricing: BUILTIN_PRICING, source: 'builtin' });
}
