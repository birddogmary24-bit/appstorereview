import { NextRequest, NextResponse } from 'next/server';
import { loadInsights, loadReviews, saveInsights } from '@/lib/storage';
import { generateMonthlyInsight } from '@/lib/insight-generator';
import { getAppByIdOrThrow } from '@/lib/apps';
import { verifyPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params;
  getAppByIdOrThrow(appId);
  const insights = await loadInsights(appId);
  return NextResponse.json(insights);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params;
  getAppByIdOrThrow(appId);

  const body = await request.json().catch(() => ({}));
  if (!verifyPassword(body.password || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const month = body.month || (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

  const reviews = await loadReviews(appId);
  const insight = await generateMonthlyInsight(month, reviews, appId);

  const existing = await loadInsights(appId);
  const updated = existing.filter(i => i.month !== month);
  updated.push(insight);
  await saveInsights(appId, updated);

  return NextResponse.json(insight);
}
