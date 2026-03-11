import { NextRequest, NextResponse } from 'next/server';
import { OTT_APPS } from '@/lib/apps';
import { loadReviews, getMonthlyStats } from '@/lib/storage';
import { authenticateApiRequest, addRateLimitHeaders } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/compare
 * OTT 앱 간 비교 데이터 조회
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (!auth.success) return auth.response;

  const { searchParams } = new URL(request.url);
  const appIds = searchParams.get('apps')?.split(',') || OTT_APPS.map(a => a.id);

  const results = await Promise.all(
    appIds.map(async (appId) => {
      const app = OTT_APPS.find(a => a.id === appId);
      if (!app) return null;

      const reviews = await loadReviews(appId);
      const stats = await getMonthlyStats(appId);

      const totalReviews = reviews.length;
      const avgScore = totalReviews > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.score, 0) / totalReviews) * 100) / 100
        : 0;
      const positive = reviews.filter(r => r.score >= 3).length;
      const negative = reviews.filter(r => r.score < 3).length;

      const complaintCounts: Record<string, number> = {};
      const complimentCounts: Record<string, number> = {};
      reviews.forEach(r => {
        if (r.score < 3) {
          complaintCounts[r.subCategory] = (complaintCounts[r.subCategory] || 0) + 1;
        } else {
          complimentCounts[r.subCategory] = (complimentCounts[r.subCategory] || 0) + 1;
        }
      });

      const topComplaints = Object.entries(complaintCounts)
        .map(([subCategory, count]) => ({ subCategory, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const topCompliments = Object.entries(complimentCounts)
        .map(([subCategory, count]) => ({ subCategory, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        appId,
        appName: app.name,
        totalReviews,
        avgScore,
        positiveRatio: totalReviews > 0 ? Math.round((positive / totalReviews) * 100) : 0,
        negativeRatio: totalReviews > 0 ? Math.round((negative / totalReviews) * 100) : 0,
        latestMonthStats: stats[0] || null,
        topComplaints,
        topCompliments,
      };
    })
  );

  const comparisons = results.filter(c => c !== null);

  const response = NextResponse.json({
    data: comparisons,
    meta: { total: comparisons.length },
  });
  return addRateLimitHeaders(response, auth.remaining);
}
