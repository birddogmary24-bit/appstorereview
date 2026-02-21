'use client';

import { useState } from 'react';
import { AppComparisonData, OttApp } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface CompareClientProps {
  comparisons: AppComparisonData[];
  apps: OttApp[];
}

const TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  fontSize: '13px',
  color: '#111827',
};

export function CompareClient({ comparisons, apps }: CompareClientProps) {
  const [categoryTab, setCategoryTab] = useState<'불만' | '칭찬' | '전체'>('전체');
  const hasData = comparisons.some(c => c.totalReviews > 0);
  const activeApps = comparisons.filter(c => c.totalReviews > 0);

  if (!hasData) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
        <p>비교할 데이터가 없습니다. 먼저 각 OTT 서비스의 리뷰를 수집해주세요.</p>
      </div>
    );
  }

  // Score comparison
  const scoreData = activeApps.map(c => ({
    name: c.appName,
    '평균 별점': c.avgScore,
    '긍정 비율': c.positiveRatio,
    '리뷰 수': c.totalReviews,
  }));

  // Category-by-OTT data: collect all subcategories across all apps
  const allSubCategories = new Set<string>();
  activeApps.forEach(c => {
    if (c.categoryBreakdown) {
      Object.keys(c.categoryBreakdown).forEach(sc => allSubCategories.add(sc));
    }
  });

  // Determine negative/positive subcategories for filtering
  const negativeSubCategories = [
    '플레이어/재생 오류', '광고 관련 불만', '요금/결제/구독', '콘텐츠 부족/불만',
    'UI/UX 불편', '앱 안정성(크래시/버그)', '자막/더빙 품질', '기타 불만',
  ];
  const positiveSubCategories = [
    '오리지널 콘텐츠', '화질/재생 품질', 'UI 편리성', '콘텐츠 다양성',
    '합리적 가격', '자막/더빙 품질', '기타 칭찬',
  ];

  // Build category comparison data for chart
  const filteredSubCategories = [...allSubCategories].filter(sc => {
    if (categoryTab === '불만') return negativeSubCategories.includes(sc);
    if (categoryTab === '칭찬') return positiveSubCategories.includes(sc);
    return true;
  });

  // Sort by total count across all apps
  const sortedSubCategories = filteredSubCategories.sort((a, b) => {
    const totalA = activeApps.reduce((sum, c) => sum + (c.categoryBreakdown?.[a] || 0), 0);
    const totalB = activeApps.reduce((sum, c) => sum + (c.categoryBreakdown?.[b] || 0), 0);
    return totalB - totalA;
  });

  const categoryChartData = sortedSubCategories.map(sc => {
    const row: Record<string, string | number> = { category: sc };
    activeApps.forEach(c => {
      row[c.appName] = c.categoryBreakdown?.[sc] || 0;
    });
    return row;
  });

  // App colors for chart bars
  const appColors: Record<string, string> = {};
  activeApps.forEach(c => {
    const app = apps.find(a => a.id === c.appId);
    if (app) appColors[c.appName] = app.color;
  });

  return (
    <div className="space-y-8">
      {/* Summary table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left px-4 py-3 font-bold">서비스</th>
              <th className="text-right px-4 py-3 font-bold">리뷰 수</th>
              <th className="text-right px-4 py-3 font-bold">평균 별점</th>
              <th className="text-right px-4 py-3 font-bold">긍정 비율</th>
              <th className="text-right px-4 py-3 font-bold">부정 비율</th>
              <th className="text-left px-4 py-3 font-bold">주요 불만</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((c) => {
              const app = apps.find(a => a.id === c.appId);
              return (
                <tr key={c.appId} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: app?.color }}
                      />
                      <span className="font-medium">{c.appName}</span>
                    </div>
                  </td>
                  <td className="text-right px-4 py-3">{c.totalReviews.toLocaleString()}</td>
                  <td className="text-right px-4 py-3">
                    <span className="text-yellow-500">★</span> {c.avgScore}
                  </td>
                  <td className="text-right px-4 py-3">
                    <span className="text-success">{c.positiveRatio}%</span>
                  </td>
                  <td className="text-right px-4 py-3">
                    <span className="text-danger">{c.negativeRatio}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.topComplaints.slice(0, 3).map(tc => (
                        <span
                          key={tc.subCategory}
                          className="text-xs px-1.5 py-0.5 bg-danger/10 text-danger rounded"
                        >
                          {tc.subCategory} ({tc.count})
                        </span>
                      ))}
                      {c.totalReviews === 0 && (
                        <span className="text-xs text-muted-foreground">데이터 없음</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Score comparison chart */}
      {scoreData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold">평균 별점 비교</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={scoreData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={13} />
              <YAxis domain={[0, 5]} stroke="#6b7280" fontSize={13} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: '13px' }} />
              <Bar dataKey="평균 별점" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Positive ratio comparison */}
      {scoreData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold">긍정 비율 비교</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={scoreData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={13} />
              <YAxis domain={[0, 100]} stroke="#6b7280" fontSize={13} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: '13px' }} />
              <Bar dataKey="긍정 비율" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category-by-OTT comparison */}
      {categoryChartData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-bold">카테고리별 OTT 비교</h2>
            <div className="flex gap-2">
              {(['전체', '불만', '칭찬'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setCategoryTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    categoryTab === tab
                      ? 'bg-primary text-white'
                      : 'bg-secondary text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(400, sortedSubCategories.length * 45)}>
            <BarChart data={categoryChartData} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#6b7280" fontSize={12} />
              <YAxis
                dataKey="category"
                type="category"
                stroke="#6b7280"
                fontSize={12}
                width={110}
                tick={{ fill: '#6b7280' }}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: '13px' }} />
              {activeApps.map(c => (
                <Bar
                  key={c.appId}
                  dataKey={c.appName}
                  fill={appColors[c.appName] || '#6366f1'}
                  radius={[0, 4, 4, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category detail table */}
      {sortedSubCategories.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-bold">카테고리별 리뷰 수 상세</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-bold sticky left-0 bg-secondary/50">카테고리</th>
                  {activeApps.map(c => {
                    const app = apps.find(a => a.id === c.appId);
                    return (
                      <th key={c.appId} className="text-right px-4 py-3 font-bold min-w-[80px]">
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ backgroundColor: app?.color }}
                          />
                          {c.appName}
                        </div>
                      </th>
                    );
                  })}
                  <th className="text-right px-4 py-3 font-bold">합계</th>
                </tr>
              </thead>
              <tbody>
                {sortedSubCategories.map(sc => {
                  const isNegative = negativeSubCategories.includes(sc);
                  const total = activeApps.reduce((sum, c) => sum + (c.categoryBreakdown?.[sc] || 0), 0);
                  return (
                    <tr key={sc} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="px-4 py-3 sticky left-0 bg-card">
                        <span className={`inline-flex items-center gap-1.5 ${isNegative ? 'text-danger' : 'text-success'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isNegative ? 'bg-danger' : 'bg-success'}`} />
                          {sc}
                        </span>
                      </td>
                      {activeApps.map(c => {
                        const count = c.categoryBreakdown?.[sc] || 0;
                        const maxCount = Math.max(...activeApps.map(a => a.categoryBreakdown?.[sc] || 0));
                        return (
                          <td key={c.appId} className="text-right px-4 py-3">
                            <span className={count === maxCount && count > 0 ? 'font-bold text-foreground' : 'text-muted-foreground'}>
                              {count > 0 ? count.toLocaleString() : '-'}
                            </span>
                          </td>
                        );
                      })}
                      <td className="text-right px-4 py-3 font-bold">{total.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
