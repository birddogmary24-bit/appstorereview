import { NextRequest, NextResponse } from 'next/server';
import { OTT_APPS } from '@/lib/apps';
import { getLastUpdateTimestamp } from '@/lib/storage';
import { authenticateApiRequest, addRateLimitHeaders } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/apps
 * 전체 OTT 앱 목록 및 마지막 업데이트 시간 조회
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (!auth.success) return auth.response;

  const appsWithStatus = await Promise.all(
    OTT_APPS.map(async (app) => {
      const lastUpdate = await getLastUpdateTimestamp(app.id);
      return {
        id: app.id,
        name: app.name,
        icon: app.icon,
        lastUpdate,
      };
    })
  );

  const response = NextResponse.json({
    data: appsWithStatus,
    meta: { total: appsWithStatus.length },
  });
  return addRateLimitHeaders(response, auth.remaining);
}
