import { getAppById, OTT_APPS, SUB_CATEGORIES } from '@/lib/apps';
import { loadReviews, getMonthlyStats, getLastUpdateTimestamp } from '@/lib/storage';
import { StatCards } from '@/components/dashboard/stat-cards';
import { SentimentChart } from '@/components/dashboard/sentiment-chart';
import { RecentReviews } from '@/components/dashboard/recent-reviews';
import Link from 'next/link';
import { ArrowRight, Info } from 'lucide-react';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  return OTT_APPS.map(app => ({ appId: app.id }));
}

export default async function AppDashboardPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const { appId } = await params;
  const app = getAppById(appId);
  if (!app) return notFound();
  const reviews = await loadReviews(appId);
  const stats = await getMonthlyStats(appId);
  const lastUpdate = await getLastUpdateTimestamp(appId);
  const recentReviews = [...reviews].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  // Category distribution
  const categoryCounts: Record<string, number> = {};
  reviews.forEach(r => {
    categoryCounts[r.subCategory] = (categoryCounts[r.subCategory] || 0) + 1;
  });
  const sortedCategories = Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-8">
      {/* Collection Info */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-primary" />
          <h3 className="font-bold">수집 기준</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-1">Google Play ID</p>
            <p className="font-mono text-xs">{app.googlePlayId}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">App Store ID</p>
            <p className="font-mono text-xs">{app.appStoreId}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">수집 범위</p>
            <p>GP 최대 1,500건 / AS 최대 500건</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">마지막 업데이트</p>
            <p>{lastUpdate ? new Date(lastUpdate).toLocaleString('ko-KR') : '미수집'}</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border text-sm">
          <p className="text-muted-foreground text-xs mb-1">AI 분석 모델</p>
          <p>Gemini 2.0 Flash · 배치 50건 · 별점 3+ 칭찬 / 2- 불만 자동 분류</p>
        </div>
      </div>

      {/* Stats Cards */}
      <StatCards reviews={reviews} stats={stats} appName={app.name} />

      {/* Chart */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-bold">감성 분석 추이</h2>
        <SentimentChart stats={stats} />
      </div>

      {/* Category Distribution */}
      {sortedCategories.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold">카테고리별 분포</h2>
          <div className="space-y-2">
            {sortedCategories.map(([cat, count]) => {
              const pct = Math.round((count / reviews.length) * 100);
              const isNegative = SUB_CATEGORIES['불만'].includes(cat);
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-sm w-44 truncate">{cat}</span>
                  <div className="flex-1 h-5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isNegative ? 'bg-danger/70' : 'bg-success/70'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-20 text-right">
                    {count}건 ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Reviews */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">최근 리뷰</h2>
          <Link
            href={`/${appId}/reviews`}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            전체 보기 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <RecentReviews reviews={recentReviews} />
      </div>
    </div>
  );
}
