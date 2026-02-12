import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getAppByIdOrThrow } from '@/lib/apps';
import { categorizeReviewsBatch } from '@/lib/ai';
import { loadReviews } from '@/lib/storage';
import { AnalyzedReview } from '@/lib/types';
import fs from 'fs/promises';
import path from 'path';

export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params;

  // Password check
  const passwordHash = process.env.UPDATE_PASSWORD_HASH;
  if (passwordHash) {
    const body = await request.json().catch(() => ({}));
    const inputHash = createHash('sha256').update(body.password || '').digest('hex');
    if (inputHash !== passwordHash) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const app = getAppByIdOrThrow(appId);
    const allReviews = await loadReviews(appId);

    // Find reviews with analysis errors
    const errorReviews = allReviews.filter(r => r.subCategory === '분석오류' || r.subCategory === '미분류');
    const okReviews = allReviews.filter(r => r.subCategory !== '분석오류' && r.subCategory !== '미분류');

    if (errorReviews.length === 0) {
      return NextResponse.json({ message: 'No reviews need reanalysis', total: allReviews.length });
    }

    console.log(`[Reanalyze] ${app.name}: ${errorReviews.length} reviews need reanalysis`);

    // Strip analysis fields to re-analyze as plain reviews
    const plainReviews = errorReviews.map(r => ({
      id: r.id,
      userName: r.userName,
      userImage: r.userImage,
      date: r.date,
      score: r.score,
      title: r.title,
      text: r.text,
      url: r.url,
      store: r.store,
    }));

    // Re-analyze
    const reanalyzed = await categorizeReviewsBatch(plainReviews, appId);

    // Merge: keep ok reviews + replace error reviews with reanalyzed
    const merged = [...okReviews, ...reanalyzed];

    // Save directly
    const DATA_DIR = path.join(process.cwd(), 'data');
    const dir = path.join(DATA_DIR, appId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'reviews.json'), JSON.stringify(merged, null, 2));

    // Count results
    const stillError = reanalyzed.filter(r => r.subCategory === '분석오류').length;
    const fixed = reanalyzed.length - stillError;

    return NextResponse.json({
      app: app.name,
      totalReviews: merged.length,
      reanalyzed: reanalyzed.length,
      fixed,
      stillError,
    });
  } catch (error) {
    console.error(`[Reanalyze] Error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
