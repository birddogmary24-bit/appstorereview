'use client';

import { useState, useMemo, useEffect } from 'react';
import { AnalyzedReview, Category } from '@/lib/types';
import { SUB_CATEGORIES } from '@/lib/apps';
import { Search, Download, Calendar, Star } from 'lucide-react';

interface ReviewListClientProps {
  reviews: AnalyzedReview[];
  appId: string;
  availableMonths: string[];
  starCounts: Record<number, number>;
}

const ITEMS_PER_PAGE = 30;

export function ReviewListClient({ reviews, appId, availableMonths, starCounts }: ReviewListClientProps) {
  const [categoryFilter, setCategoryFilter] = useState<Category | '전체'>('전체');
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>('전체');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [scoreFilter, setScoreFilter] = useState<number | '전체'>('전체');
  const [currentPage, setCurrentPage] = useState(1);
  const [isMonthFilterOpen, setIsMonthFilterOpen] = useState(false);
  const [isStarFilterOpen, setIsStarFilterOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Dynamic subcategories
  const availableSubCategories = useMemo(() => {
    if (categoryFilter === '전체') {
      return [...SUB_CATEGORIES['불만'], ...SUB_CATEGORIES['칭찬'], ...SUB_CATEGORIES['기타']];
    }
    return SUB_CATEGORIES[categoryFilter] || [];
  }, [categoryFilter]);

  // Filtered reviews
  const filtered = useMemo(() => {
    let result = [...reviews];

    if (categoryFilter !== '전체') result = result.filter(r => r.category === categoryFilter);
    if (subCategoryFilter !== '전체') result = result.filter(r => r.subCategory === subCategoryFilter);
    if (scoreFilter !== '전체') result = result.filter(r => r.score === scoreFilter);
    if (selectedMonths.length > 0) result = result.filter(r => selectedMonths.includes(r.date.substring(0, 7)));
    if (searchDebounce) {
      const q = searchDebounce.toLowerCase();
      result = result.filter(r =>
        r.text.toLowerCase().includes(q) || r.userName.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [reviews, categoryFilter, subCategoryFilter, scoreFilter, selectedMonths, searchDebounce]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const toggleMonth = (month: string) => {
    setSelectedMonths(prev =>
      prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
    );
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Top toolbar */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="리뷰 내용 또는 사용자명 검색..."
            className="w-full bg-secondary border border-border rounded-xl pl-10 pr-4 py-3 text-sm"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>

        {/* Month filter */}
        <div className="relative">
          <button
            onClick={() => { setIsMonthFilterOpen(!isMonthFilterOpen); setIsStarFilterOpen(false); }}
            className="flex items-center gap-2 px-4 py-3 bg-secondary border border-border rounded-xl text-sm font-bold hover:bg-muted transition-colors"
          >
            <Calendar className="w-4 h-4" />
            {selectedMonths.length === 0 ? '모든 기간' : `${selectedMonths.length}개 월`}
          </button>
          {isMonthFilterOpen && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-2xl p-2 z-50">
              <div className="flex justify-between items-center px-2 py-1 mb-1">
                <span className="text-xs font-bold text-muted-foreground">기간 선택</span>
                <button
                  onClick={() => { setSelectedMonths([]); setCurrentPage(1); }}
                  className="text-xs text-primary hover:underline"
                >
                  전체 해제
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {availableMonths.map(m => (
                  <label key={m} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={selectedMonths.includes(m)}
                      onChange={() => toggleMonth(m)}
                      className="rounded"
                    />
                    <span>{m}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={() => setIsMonthFilterOpen(false)}
                className="w-full mt-2 px-3 py-1.5 bg-secondary rounded-lg text-xs font-bold hover:bg-muted transition-colors"
              >
                닫기
              </button>
            </div>
          )}
        </div>

        {/* Star filter */}
        <div className="relative">
          <button
            onClick={() => { setIsStarFilterOpen(!isStarFilterOpen); setIsMonthFilterOpen(false); }}
            className="flex items-center gap-2 px-4 py-3 bg-secondary border border-border rounded-xl text-sm font-bold hover:bg-muted transition-colors"
          >
            <Star className="w-4 h-4" />
            {scoreFilter === '전체' ? `모든 별점 (${reviews.length})` : `${scoreFilter}점 (${starCounts[scoreFilter] || 0})`}
          </button>
          {isStarFilterOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-2xl p-2 z-50">
              <button
                onClick={() => { setScoreFilter('전체'); setCurrentPage(1); setIsStarFilterOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${scoreFilter === '전체' ? 'bg-primary text-white' : 'hover:bg-secondary'}`}
              >
                모든 별점 ({reviews.length})
              </button>
              {[5, 4, 3, 2, 1].map(s => (
                <button
                  key={s}
                  onClick={() => { setScoreFilter(s); setCurrentPage(1); setIsStarFilterOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm ${scoreFilter === s ? 'bg-primary text-white' : 'hover:bg-secondary'}`}
                >
                  <span className="text-yellow-500">{'★'.repeat(s)}{'☆'.repeat(5 - s)}</span>
                  {' '}({starCounts[s] || 0})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Category buttons */}
        <div className="flex gap-2">
          {(['전체', '칭찬', '불만'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setCategoryFilter(cat);
                setSubCategoryFilter('전체');
                setCurrentPage(1);
              }}
              className={`px-5 py-3 rounded-xl text-sm font-bold transition-all ${
                categoryFilter === cat
                  ? 'bg-primary text-white shadow-lg'
                  : 'bg-secondary text-foreground hover:bg-muted border border-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Excel export */}
        <a
          href={`/api/${appId}/export`}
          className="flex items-center gap-2 px-4 py-3 bg-secondary border border-border rounded-xl text-sm font-bold hover:bg-muted transition-colors"
        >
          <Download className="w-4 h-4" />
          Excel
        </a>
      </div>

      {/* SubCategory chips */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">상세 필터:</span>
        <button
          onClick={() => { setSubCategoryFilter('전체'); setCurrentPage(1); }}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
            subCategoryFilter === '전체'
              ? 'bg-white text-black border-white'
              : 'bg-transparent text-muted-foreground border-border hover:border-muted-foreground'
          }`}
        >
          전체
        </button>
        {availableSubCategories.map(sub => (
          <button
            key={sub}
            onClick={() => { setSubCategoryFilter(sub); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
              subCategoryFilter === sub
                ? 'bg-white text-black border-white'
                : 'bg-transparent text-muted-foreground border-border hover:border-muted-foreground'
            }`}
          >
            {sub}
          </button>
        ))}
      </div>

      {/* Review table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-secondary/50 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              <th className="px-6 py-4">날짜</th>
              <th className="px-6 py-4">사용자</th>
              <th className="px-6 py-4">분석 분류</th>
              <th className="px-6 py-4">별점</th>
              <th className="px-6 py-4 w-1/2">리뷰 내용</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center text-muted-foreground">
                  {reviews.length === 0
                    ? '아직 수집된 리뷰가 없습니다.'
                    : '필터 조건에 맞는 데이터가 없습니다.'}
                </td>
              </tr>
            ) : (
              paginated.map((r) => (
                <tr
                  key={`${r.store}-${r.id}`}
                  className="hover:bg-white/5 transition-all group border-l-2 border-l-transparent hover:border-l-primary"
                >
                  <td className="px-6 py-4 text-xs font-bold whitespace-nowrap">
                    {new Date(r.date).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-sm">{r.userName}</span>
                      <span
                        className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded w-fit ${
                          r.store === 'google-play'
                            ? 'bg-blue-900/40 text-blue-400'
                            : 'bg-gray-700/40 text-gray-400'
                        }`}
                      >
                        {r.store === 'google-play' ? 'Google Play' : 'App Store'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded font-bold w-fit ${
                          r.category === '칭찬' ? 'bg-green-500/20 text-green-400' :
                          r.category === '불만' ? 'bg-red-500/20 text-red-400' :
                          'bg-muted text-muted-foreground'
                        }`}
                      >
                        {r.category}
                      </span>
                      <span className="text-[11px] font-bold text-muted-foreground">{r.subCategory || '미분류'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-yellow-500 font-bold text-xs">
                      {'★'.repeat(r.score)}{'☆'.repeat(5 - r.score)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm leading-relaxed text-foreground/90">
                    &quot;{r.text}&quot;
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <div className="text-xs font-bold text-muted-foreground uppercase">
              Total <span className="text-foreground">{filtered.length.toLocaleString()}</span> items
              {' '}&middot; Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => {
                  setCurrentPage(p => p - 1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-4 py-2 border border-border rounded-lg font-bold text-xs hover:bg-white hover:text-black transition-all disabled:opacity-20"
              >
                PREV
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => {
                  setCurrentPage(p => p + 1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-4 py-2 border border-border rounded-lg font-bold text-xs hover:bg-white hover:text-black transition-all disabled:opacity-20"
              >
                NEXT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
