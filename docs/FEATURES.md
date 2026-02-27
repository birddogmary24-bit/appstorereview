# AppScope - 기능 정의서

> 버전: 1.0
> 최종 수정일: 2026-02-25

---

## 1. 페이지 구성

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/` | 통합 대시보드 | 6개 앱 요약, 전체 수집 버튼 |
| `/compare` | 앱 비교 | 앱 간 점수/긍정률/카테고리 비교 |
| `/{appId}` | 앱 대시보드 | 개별 앱 통계, 감성 추이, 최근 리뷰 |
| `/{appId}/reviews` | 전체 리뷰 | 검색/필터/테이블/Excel 내보내기 |
| `/{appId}/insights` | 인사이트 | 월간 AI 리포트 및 개선 과제 |

**지원 앱ID:** `tving`, `netflix`, `disneyplus`, `wavve`, `coupangplay`, `watcha`

---

## 2. 기능 상세 정의

### 2.1 통합 대시보드 (`/`)

**목적**: 6개 OTT 앱의 리뷰 현황을 한눈에 파악

**표시 항목 (앱 카드당):**
- 앱명 및 아이콘
- 전체 리뷰 수
- 긍정 비율 (%)
- 마지막 수집 일시

**버튼:**
| 버튼 | 동작 | 인증 |
|------|------|------|
| 개별 앱 수집 | 해당 앱 1개 수집+분석+인사이트 생성 | 비밀번호 필요 |
| 전체 수집 | 6개 앱 순차 수집 (앱 간 5초 간격) | 비밀번호 필요 |

**수집 진행 중 UI:**
- 버튼 비활성화
- 진행 중 앱명 표시
- 완료/에러 상태 인라인 표시

---

### 2.2 앱 비교 (`/compare`)

**목적**: 경쟁 OTT 서비스 간 리뷰 품질 비교

**비교 항목:**
- 평균 별점 (1~5점)
- 긍정 비율, 부정 비율
- 카테고리별 건수 (가로 막대 차트)

**필터:**
- 전체 / 칭찬만 / 불만만 카테고리 전환

**표**: 서비스별 × 카테고리별 건수 매트릭스

---

### 2.3 앱 대시보드 (`/{appId}`)

**목적**: 개별 앱의 리뷰 통계 및 추이 파악

#### 2.3.1 KPI 카드 (4종)
| 카드 | 내용 |
|------|------|
| 총 리뷰 수 | 전체 수집된 리뷰 수 |
| 평균 별점 | 소수점 1자리 |
| 긍정 비율 | 칭찬 건수 / 전체 × 100% |
| 최근 업데이트 | 마지막 수집 일시 |

#### 2.3.2 감성 추이 차트
- X축: 월별
- Y축: 건수
- 계열: 칭찬 / 불만 / 기타 (3색 선 그래프)
- 기간: 전체 데이터 기준 월별 집계

#### 2.3.3 카테고리 분포
- 도넛/바 차트로 세부 사유별 분포 시각화

#### 2.3.4 최근 리뷰 그리드
- 최신 리뷰 6~12건 카드 형태 표시
- 별점, 스토어(GP/AS), 카테고리, 날짜, 내용 미리보기

---

### 2.4 전체 리뷰 (`/{appId}/reviews`)

**목적**: 원시 리뷰 데이터 탐색 및 내보내기

#### 2.4.1 필터

| 필터 | 옵션 |
|------|------|
| 카테고리 | 전체 / 칭찬 / 불만 / 기타 |
| 세부 사유 | 카테고리 선택 시 동적 표시 |
| 별점 | 1~5점 (복수 선택) |
| 월 | YYYY-MM 드롭다운 |
| 스토어 | 전체 / Google Play / App Store |
| 검색어 | 리뷰 내용 전문 검색 |

#### 2.4.2 리뷰 테이블

| 컬럼 | 내용 |
|------|------|
| 날짜 | YYYY-MM-DD |
| 스토어 | GP / AS 배지 |
| 별점 | ★ 표시 |
| 대분류 | 칭찬/불만/기타 색상 배지 |
| 세부사유 | 텍스트 태그 |
| 내용 | 리뷰 전문 (펼치기 가능) |

- 페이지당 50건
- 정렬: 최신순 고정

#### 2.4.3 Excel 내보내기

**시트 1: 월별 통계**
- 컬럼: 월, 칭찬, 불만, 기타, 총계, 긍정 비율

**시트 2: 세부 사유별 통계**
- 컬럼: 대분류, 세부사유, 건수

**시트 3: 전체 리뷰**
- 컬럼: 날짜, 스토어, 별점, 대분류, 세부사유, 내용
- **개인정보 제외**: 사용자명 미포함

---

### 2.5 인사이트 (`/{appId}/insights`)

**목적**: AI가 생성한 월간 분석 리포트 열람 및 신규 생성

#### 2.5.1 월 선택기
- 드롭다운으로 분석 가능한 월 목록 표시
- 인사이트가 없는 월은 생성 버튼 활성화

#### 2.5.2 리포트 구성

**① 트렌드 요약 (summary)**
- 해당 월 전반적인 리뷰 트렌드 1~2문장

**② 긍정 인사이트 (positiveInsights)**
- 최대 10건
- 각 항목: 제목, 설명, 건수, 심각도, 스파이크 여부, 직무 레이블, 관련 세부 사유

**③ 부정 인사이트 (negativeInsights)**
- 최대 10건
- 동일 구조

**④ 개선 과제 (tasks)**
- 5~7건
- 각 항목: 제목, 설명, 우선순위(high/medium/low), 직무 레이블
- PRD 자동 생성 포함:
  - 문제 정의 (definition)
  - 목적 (purpose)
  - 기대 효과 (expectedEffect)
  - 핵심 기능 (keyFeatures)
  - 역할별 담당 (planning / development / design / marketing)

#### 2.5.3 인사이트 생성 트리거
- UI 버튼 클릭 → POST `/api/{appId}/insights` (비밀번호 필요)
- Cloud Scheduler 자동 실행 (월 1회)

---

## 3. API 명세

### 3.1 공개 API (인증 불필요)

| Method | 경로 | 설명 | 주요 파라미터 |
|--------|------|------|--------------|
| GET | `/api/apps` | 전체 앱 목록 + 마지막 업데이트 | - |
| GET | `/api/compare` | 앱 비교 데이터 | - |
| GET | `/api/{appId}/stats` | 월별 통계 | - |
| GET | `/api/{appId}/reviews` | 리뷰 목록 | `page`, `category`, `subCategory`, `score`, `month`, `store`, `search` |
| GET | `/api/{appId}/insights` | 인사이트 목록 | - |
| GET | `/api/{appId}/export` | Excel 다운로드 | - |

### 3.2 보호 API (비밀번호 필요)

| Method | 경로 | 설명 | 타임아웃 | Body |
|--------|------|------|---------|------|
| POST | `/api/{appId}/batch` | 수집 + AI 분석 + 인사이트 | 300초 | `{ "password": "..." }` |
| POST | `/api/{appId}/reanalyze` | 분석오류 리뷰 재처리 | 300초 | `{ "password": "..." }` |
| POST | `/api/{appId}/insights` | 특정 월 인사이트 생성 | - | `{ "password": "...", "month": "YYYY-MM" }` |

**인증 실패 응답:** `HTTP 401` + `{ "error": "Unauthorized" }`

---

## 4. 데이터 모델

### 4.1 AnalyzedReview (분석된 리뷰)

```typescript
interface AnalyzedReview {
  id: string;                              // 스토어 리뷰 ID
  userName: string;                        // 작성자명
  date: string;                            // ISO 8601 날짜
  score: number;                           // 별점 1~5
  text: string;                            // 리뷰 내용
  store: 'google-play' | 'app-store';      // 출처 스토어
  appId: string;                           // 앱 식별자
  category: '칭찬' | '불만' | '기타';       // AI 대분류
  subCategory: string;                     // AI 세부 사유
  analysisDate: string;                    // AI 분석 시점 ISO 8601
}
```

### 4.2 MonthlyInsight (월간 인사이트)

```typescript
interface MonthlyInsight {
  month: string;                           // YYYY-MM
  summary: string;                         // 트렌드 요약
  positiveInsights: InsightItem[];
  negativeInsights: InsightItem[];
  tasks: ImprovementTask[];
  generatedAt: string;                     // 생성 시점 ISO 8601
}

interface InsightItem {
  title: string;
  description: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
  sentiment: 'positive' | 'negative';
  isSpiked: boolean;                       // 급증 여부
  jobLabels: string[];                     // 직무 레이블
  relatedSubCategories: string[];
}

interface ImprovementTask {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  jobLabels: string[];
  prd?: {
    definition: string;
    purpose: string;
    expectedEffect: string;
    keyFeatures: string[];
    roles: {
      planning?: string;
      development?: string;
      design?: string;
      marketing?: string;
    };
  };
}
```

### 4.3 AppStatus (앱 상태)

```typescript
interface AppStatus {
  lastUpdate: string;                      // 마지막 수집 시점 ISO 8601
}
```

---

## 5. 화면 레이아웃

### 5.1 전체 레이아웃
```
┌─────────────────────────────────────────────────┐
│  좌측 사이드바 (앱 목록)  │  메인 콘텐츠 영역      │
│  - 통합 대시보드          │                       │
│  - 앱 비교                │                       │
│  - 티빙                   │                       │
│  - 넷플릭스               │                       │
│  - 디즈니+                │                       │
│  - 웨이브                 │                       │
│  - 쿠팡플레이             │                       │
│  - 왓챠                   │                       │
└─────────────────────────────────────────────────┘
```

### 5.2 앱 페이지 레이아웃
```
┌──────────────────────────────────────────────────┐
│  [대시보드] [전체 리뷰] [인사이트]  ← 탭 네비게이션 │
├──────────────────────────────────────────────────┤
│  메인 콘텐츠                                       │
└──────────────────────────────────────────────────┘
```

### 5.3 디자인 시스템
| 항목 | 값 |
|------|-----|
| 테마 | 라이트 모드 |
| 폰트 | Pretendard (한국어 최적화) |
| 주요 색상 | Primary: #7c3aed (보라) |
| 성공 색상 | #34d399 (초록) |
| 위험 색상 | #f87171 (빨강) |
| 카드 스타일 | rounded-xl, 그림자 |
| 버튼 스타일 | rounded-full / rounded-lg |
