import { NextRequest, NextResponse } from 'next/server';
import { loadReviews } from '@/lib/storage';
import { getAppById, SUB_CATEGORIES } from '@/lib/apps';
import { authenticateApiRequest, addRateLimitHeaders } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/apps/:appId/categories
 * 앱의 카테고리별 리뷰 분포 조회
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

  const reviews = await loadReviews(appId);

  // Category-level breakdown
  const categoryBreakdown: Record<string, number> = { '칭찬': 0, '불만': 0, '기타': 0 };
  const subCategoryBreakdown: Record<string, number> = {};

  reviews.forEach(r => {
    categoryBreakdown[r.category] = (categoryBreakdown[r.category] || 0) + 1;
    subCategoryBreakdown[r.subCategory] = (subCategoryBreakdown[r.subCategory] || 0) + 1;
  });

  const subCategories = Object.entries(subCategoryBreakdown)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const response = NextResponse.json({
    data: {
      totalReviews: reviews.length,
      categories: categoryBreakdown,
      subCategories,
      availableCategories: SUB_CATEGORIES,
    },
    meta: { appId, appName: app.name },
  });
  return addRateLimitHeaders(response, auth.remaining);
}
