import { getAppByIdOrThrow, OTT_APPS } from '@/lib/apps';
import { loadInsights } from '@/lib/storage';
import { AlertTriangle, TrendingUp, CheckCircle, Lightbulb } from 'lucide-react';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  return OTT_APPS.map(app => ({ appId: app.id }));
}

export default async function InsightsPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const { appId } = await params;
  const app = getAppByIdOrThrow(appId);
  const insights = await loadInsights(appId);

  const latest = insights.length > 0
    ? insights.sort((a, b) => b.month.localeCompare(a.month))[0]
    : null;

  return (
    <div className="space-y-8">
      {!latest ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center space-y-3">
          <Lightbulb className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">
            아직 인사이트가 없습니다. 먼저 리뷰를 수집하면 자동으로 인사이트가 생성됩니다.
          </p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{latest.month} 월간 요약</h2>
              <span className="text-xs text-muted-foreground">
                {new Date(latest.generatedAt).toLocaleString('ko-KR')}
              </span>
            </div>
            <p className="text-sm text-foreground/85 leading-relaxed">{latest.summary}</p>
          </div>

          {/* Positive Insights */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-success" />
              긍정 인사이트 ({latest.positiveInsights.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {latest.positiveInsights.map((item, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-sm">{item.title}</h3>
                    <div className="flex items-center gap-2">
                      {item.isSpiked && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 rounded font-bold">
                          SPIKE
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        item.severity === 'high' ? 'bg-success/10 text-success' :
                        item.severity === 'medium' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-gray-500/10 text-gray-400'
                      }`}>
                        {item.count}건
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.jobLabels.map(label => (
                      <span key={label} className="text-[10px] px-2 py-0.5 bg-secondary rounded text-muted-foreground">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Negative Insights */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-danger" />
              부정 인사이트 ({latest.negativeInsights.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {latest.negativeInsights.map((item, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-sm">{item.title}</h3>
                    <div className="flex items-center gap-2">
                      {item.isSpiked && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 rounded font-bold">
                          SPIKE
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        item.severity === 'high' ? 'bg-danger/10 text-danger' :
                        item.severity === 'medium' ? 'bg-yellow-500/10 text-yellow-400' :
                        'bg-gray-500/10 text-gray-400'
                      }`}>
                        {item.count}건
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.jobLabels.map(label => (
                      <span key={label} className="text-[10px] px-2 py-0.5 bg-secondary rounded text-muted-foreground">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Improvement Tasks */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              개선 과제 ({latest.tasks.length})
            </h2>
            <div className="space-y-4">
              {latest.tasks.map((task, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold">{task.title}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      task.priority === 'high' ? 'bg-danger/10 text-danger' :
                      task.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-400' :
                      'bg-gray-500/10 text-gray-400'
                    }`}>
                      {task.priority.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{task.description}</p>

                  {task.prd && (
                    <details className="pt-2">
                      <summary className="text-xs text-primary cursor-pointer hover:underline">
                        PRD 상세 보기
                      </summary>
                      <div className="mt-3 space-y-3 pl-3 border-l-2 border-primary/20">
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">문제 정의</p>
                          <p className="text-xs">{task.prd.definition}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">목적</p>
                          <p className="text-xs">{task.prd.purpose}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">기대 효과</p>
                          <p className="text-xs">{task.prd.expectedEffect}</p>
                        </div>
                        {task.prd.keyFeatures && task.prd.keyFeatures.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">핵심 기능</p>
                            <ul className="list-disc list-inside text-xs space-y-1">
                              {task.prd.keyFeatures.map((f, j) => (
                                <li key={j}>{f}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </details>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {task.jobLabels.map(label => (
                      <span key={label} className="text-[10px] px-2 py-0.5 bg-secondary rounded text-muted-foreground">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
