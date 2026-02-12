import { getAppByIdOrThrow, OTT_APPS } from '@/lib/apps';
import { loadReviews } from '@/lib/storage';
import { ReviewListClient } from '@/components/reviews/review-list';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  return OTT_APPS.map(app => ({ appId: app.id }));
}

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const { appId } = await params;
  const app = getAppByIdOrThrow(appId);
  const reviews = await loadReviews(appId);

  const availableMonths = Array.from(new Set(reviews.map(r => r.date.substring(0, 7))))
    .sort((a, b) => b.localeCompare(a));

  const starCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach(r => {
    if (starCounts[r.score] !== undefined) starCounts[r.score]++;
  });

  return (
    <div className="space-y-6">
      <ReviewListClient
        reviews={reviews}
        appId={appId}
        availableMonths={availableMonths}
        starCounts={starCounts}
      />
    </div>
  );
}
