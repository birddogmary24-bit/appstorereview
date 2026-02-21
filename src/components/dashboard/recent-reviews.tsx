import { AnalyzedReview } from '@/lib/types';

interface RecentReviewsProps {
  reviews: AnalyzedReview[];
}

export function RecentReviews({ reviews }: RecentReviewsProps) {
  if (reviews.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-10 text-sm">
        리뷰 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {reviews.slice(0, 6).map(r => (
        <div
          key={`${r.store}-${r.id}`}
          className="bg-card border border-border p-4 rounded-xl space-y-2.5 hover:border-primary/30 transition-colors"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs text-muted-foreground">
              {new Date(r.date).toLocaleDateString('ko-KR')}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-bold ${
                r.score >= 3
                  ? 'bg-success/10 text-success'
                  : 'bg-danger/10 text-danger'
              }`}
            >
              {r.subCategory}
            </span>
          </div>
          <p className="text-sm leading-relaxed line-clamp-3 text-foreground/85">
            &quot;{r.text}&quot;
          </p>
          <div className="flex justify-between items-center pt-2 border-t border-border/50">
            <span className="text-yellow-500 text-xs">{'★'.repeat(r.score)}{'☆'.repeat(5 - r.score)}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                r.store === 'google-play'
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {r.store === 'google-play' ? 'PLAY' : 'APPLE'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
