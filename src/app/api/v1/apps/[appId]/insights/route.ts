import { NextRequest, NextResponse } from 'next/server';
import { loadInsights } from '@/lib/storage';
import { getAppById } from '@/lib/apps';
import { authenticateApiRequest, addRateLimitHeaders } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/apps/:appId/insights
 * 앱의 월별 인사이트 리포트 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.success) return auth.response;

  const { appId } = await params;
  const app = getAppById(appId);
  if (!app) {
    return NextResponse.json({ error: `앱을 찾을 수 없습니다: ${appId}` }, { status: 404 });
  }

  const insights = await loadInsights(appId);

  // Optional month filter
  const month = new URL(request.url).searchParams.get('month');
  const filtered = month ? insights.filter(i => i.month === month) : insights;

  const response = NextResponse.json({
    data: filtered,
    meta: { appId, appName: app.name, total: filtered.length },
  });
  return addRateLimitHeaders(response, auth.remaining);
}
