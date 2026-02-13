import { OTT_APPS } from '@/lib/apps';
import { loadReviews, getMonthlyStats, getLastUpdateTimestamp } from '@/lib/storage';
import { BarChart3, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { BatchAllButton } from '@/components/batch-all-button';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const appSummaries = await Promise.all(
    OTT_APPS.map(async (app) => {
      const reviews = await loadReviews(app.id);
      const stats = await getMonthlyStats(app.id);
      const lastUpdate = await getLastUpdateTimestamp(app.id);

      const total = reviews.length;
      const avgScore = total > 0
        ? Math.round((reviews.reduce((s, r) => s + r.score, 0) / total) * 10) / 10
        : 0;
      const positive = reviews.filter(r => r.score >= 3).length;

      return {
        ...app,
        total,
        avgScore,
        positive,
        positiveRatio: total > 0 ? Math.round((positive / total) * 100) : 0,
        lastUpdate,
        recentMonth: stats[0] || null,
      };
    })
  );

  const totalReviews = appSummaries.reduce((s, a) => s + a.total, 0);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
          <BarChart3 className="text-primary w-8 h-8" />
          OTT 리뷰 분석 통합 대시보드
        </h1>
        <p className="text-muted-foreground text-lg">
          국내 주요 OTT 6개 서비스의 앱스토어 리뷰를 AI로 분석합니다.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-bold">전체 수집 리뷰</p>
            <p className="text-5xl font-black mt-1">{totalReviews.toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right text-base text-muted-foreground">
              <p>{OTT_APPS.length}개 OTT 서비스</p>
              <p>Google Play + App Store</p>
            </div>
            <BatchAllButton />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {appSummaries.map(app => (
          <Link
            key={app.id}
            href={`/${app.id}`}
            className="bg-card border border-border rounded-xl p-5 space-y-4 hover:border-primary/40 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 rounded-full" style={{ backgroundColor: app.color }} />
                <span className="font-bold text-lg">{app.name}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-3xl font-bold">{app.total.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">리뷰</p>
              </div>
              <div>
                <p className="text-3xl font-bold">{app.avgScore}</p>
                <p className="text-sm text-muted-foreground">평균 별점</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-success">{app.positiveRatio}%</p>
                <p className="text-sm text-muted-foreground">긍정 비율</p>
              </div>
            </div>
            {app.total > 0 && (
              <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
                <div className="bg-success rounded-l-full" style={{ width: `${app.positiveRatio}%` }} />
                <div className="bg-danger rounded-r-full" style={{ width: `${100 - app.positiveRatio}%` }} />
              </div>
            )}
            <p className="text-xs text-muted-foreground/60">
              {app.lastUpdate
                ? `마지막 업데이트: ${new Date(app.lastUpdate).toLocaleDateString('ko-KR')}`
                : '아직 데이터 없음 - 리뷰 수집을 시작하세요'}
            </p>
          </Link>
        ))}
      </div>

      {totalReviews === 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 space-y-3">
          <h3 className="font-bold text-lg">시작하기</h3>
          <ol className="list-decimal list-inside space-y-2 text-base text-muted-foreground">
            <li>왼쪽 사이드바에서 OTT 서비스를 선택하세요.</li>
            <li>&quot;리뷰 수집&quot; 버튼을 클릭하여 리뷰를 수집하세요.</li>
            <li>AI가 자동으로 감성 분석과 카테고리 분류를 수행합니다.</li>
            <li>인사이트 페이지에서 월간 분석 리포트를 확인하세요.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
