import { NextRequest, NextResponse } from 'next/server';
import { loadReviews } from '@/lib/storage';
import { getAppById } from '@/lib/apps';
import { authenticateApiRequest, addRateLimitHeaders } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/apps/:appId/reviews
 * 리뷰 목록 조회 (필터링 + 페이지네이션)
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
  const { searchParams } = new URL(request.url);

  const category = searchParams.get('category');
  const subCategory = searchParams.get('subCategory');
  const minScore = searchParams.get('minScore');
  const maxScore = searchParams.get('maxScore');
  const search = searchParams.get('search');
  const store = searchParams.get('store');
  const month = searchParams.get('month');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30')));

  let filtered = reviews;

  if (category) filtered = filtered.filter(r => r.category === category);
  if (subCategory) filtered = filtered.filter(r => r.subCategory === subCategory);
  if (minScore) filtered = filtered.filter(r => r.score >= parseInt(minScore));
  if (maxScore) filtered = filtered.filter(r => r.score <= parseInt(maxScore));
  if (store) filtered = filtered.filter(r => r.store === store);
  if (month) filtered = filtered.filter(r => r.date.startsWith(month));
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(r => r.text.toLowerCase().includes(q));
  }

  // Sort by date desc
  filtered.sort((a, b) => b.date.localeCompare(a.date));

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  // Strip userName for privacy
  const sanitized = paginated.map(({ userName, userImage, ...rest }) => rest);

  const response = NextResponse.json({
    data: sanitized,
    meta: { total, page, limit, totalPages },
  });
  return addRateLimitHeaders(response, auth.remaining);
}
