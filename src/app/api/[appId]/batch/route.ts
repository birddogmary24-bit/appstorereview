import { NextRequest, NextResponse } from 'next/server';
import { getAppByIdOrThrow } from '@/lib/apps';
import { fetchGooglePlayReviews, fetchAppStoreReviews } from '@/lib/scrapers';
import { categorizeReviewsBatch } from '@/lib/ai';
import { saveReviews, loadReviews, loadInsights, saveInsights } from '@/lib/storage';
import { generateMonthlyInsight } from '@/lib/insight-generator';
import { verifyPassword } from '@/lib/auth';

export const maxDuration = 300; // 5 minutes for Cloud Run

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params;

  const body = await request.json().catch(() => ({}));
  if (!verifyPassword(body.password || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const app = getAppByIdOrThrow(appId);
    console.log(`[Batch] Starting for ${app.name}...`);

    // 1. Fetch reviews
    const [gpReviews, asReviews] = await Promise.all([
      fetchGooglePlayReviews(app.googlePlayId),
      fetchAppStoreReviews(app.appStoreId),
    ]);

    const allFetched = [...gpReviews, ...asReviews];
    console.log(`[Batch] Fetched ${allFetched.length} reviews (GP: ${gpReviews.length}, AS: ${asReviews.length})`);

    if (allFetched.length === 0) {
      return NextResponse.json({ message: 'No reviews fetched', newCount: 0 });
    }

    // 2. Filter out already-analyzed reviews to save AI tokens
    const existing = await loadReviews(appId);
    const existingIds = new Set(existing.map(r => `${r.store}-${r.id}`));
    const newOnly = allFetched.filter(r => !existingIds.has(`${r.store}-${r.id}`));
    console.log(`[Batch] ${newOnly.length} new reviews (${allFetched.length - newOnly.length} already exist)`);

    if (newOnly.length === 0) {
      return NextResponse.json({ message: 'No new reviews', newCount: 0, totalReviews: existing.length });
    }

    // 3. AI analysis (new reviews only)
    const analyzed = await categorizeReviewsBatch(newOnly, appId);

    // 4. Save
    const { newCount } = await saveReviews(appId, analyzed);
    console.log(`[Batch] Saved ${newCount} new reviews for ${app.name}`);

    // 5. Generate insight for current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const reviews = await loadReviews(appId);
    const existingInsights = await loadInsights(appId);

    const insight = await generateMonthlyInsight(currentMonth, reviews, appId);
    const updatedInsights = existingInsights.filter(i => i.month !== currentMonth);
    updatedInsights.push(insight);
    await saveInsights(appId, updatedInsights);

    return NextResponse.json({
      app: app.name,
      fetched: allFetched.length,
      newCount,
      totalReviews: reviews.length,
      insightMonth: currentMonth,
    });
  } catch (error) {
    console.error(`[Batch] Error for ${appId}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
