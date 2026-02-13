'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

const APPS = [
  { id: 'tving', name: '티빙' },
  { id: 'netflix', name: '넷플릭스' },
  { id: 'disneyplus', name: '디즈니+' },
  { id: 'wavve', name: '웨이브' },
  { id: 'coupangplay', name: '쿠팡플레이' },
  { id: 'watcha', name: '왓챠' },
];

interface BatchResult {
  appName: string;
  success: boolean;
  newCount?: number;
  error?: string;
}

export function BatchAllButton() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

  const handleBatchAll = async () => {
    if (loading) return;

    const password = prompt('전체 리뷰 수집을 위한 관리자 비밀번호를 입력하세요:');
    if (!password) return;

    setLoading(true);
    const results: BatchResult[] = [];

    for (let i = 0; i < APPS.length; i++) {
      const app = APPS[i];
      setProgress(`${i + 1}/${APPS.length}: ${app.name} 수집 중...`);

      try {
        const res = await fetch(`/api/${app.id}/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });

        if (res.status === 401) {
          alert('비밀번호가 올바르지 않습니다.');
          setLoading(false);
          setProgress('');
          return;
        }

        const contentType = res.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          results.push({ appName: app.name, success: false, error: `서버 오류 (${res.status})` });
          continue;
        }

        const data = await res.json();
        if (res.ok) {
          results.push({ appName: app.name, success: true, newCount: data.newCount || 0 });
        } else {
          results.push({ appName: app.name, success: false, error: data.error || '알 수 없는 오류' });
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : '네트워크 오류';
        results.push({ appName: app.name, success: false, error: msg });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalNew = results.reduce((sum, r) => sum + (r.newCount || 0), 0);
    const failed = results.filter(r => !r.success);

    let summary = `전체 수집 완료: ${successCount}/${APPS.length}개 성공, ${totalNew}개 신규 리뷰`;
    if (failed.length > 0) {
      summary += `\n\n실패:\n${failed.map(f => `- ${f.appName}: ${f.error}`).join('\n')}`;
    }

    alert(summary);
    setLoading(false);
    setProgress('');
    window.location.reload();
  };

  return (
    <button
      onClick={handleBatchAll}
      disabled={loading}
      className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
    >
      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
      {loading ? progress || '준비 중...' : '전체 수집'}
    </button>
  );
}
