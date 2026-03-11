import { NextRequest, NextResponse } from 'next/server';
import { getMonthlyStats } from '@/lib/storage';
import { getAppById } from '@/lib/apps';
import { authenticateApiRequest, addRateLimitHeaders } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/apps/:appId/stats
 * 앱의 월별 통계 조회
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

  const stats = await getMonthlyStats(appId);

  const response = NextResponse.json({
    data: stats,
    meta: { appId, appName: app.name, totalMonths: stats.length },
  });
  return addRateLimitHeaders(response, auth.remaining);
}
