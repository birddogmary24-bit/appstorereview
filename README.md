# AppScope - OTT 리뷰 분석 통합 플랫폼

국내 주요 OTT 6개 서비스의 앱스토어 리뷰를 자동 수집하고, AI(Gemini 2.0 Flash)로 감성 분석 및 카테고리 분류를 수행하는 통합 대시보드 플랫폼입니다.

## 서비스 URL

| 환경 | URL |
|------|-----|
| Production | https://appscope-520722818842.asia-northeast3.run.app |
| Development | http://localhost:3001 |

---

## 1. 제품 개요 (PRD)

### 1.1 목적

OTT 서비스 운영팀이 앱스토어 리뷰를 체계적으로 모니터링하고, AI 기반 인사이트를 통해 서비스 개선 방향을 도출할 수 있도록 지원합니다.

### 1.2 대상 서비스

| 서비스 | Google Play ID | App Store ID |
|--------|---------------|-------------|
| 티빙 | net.cj.cjhv.gs.tving | 400101401 |
| 넷플릭스 | com.netflix.mediaclient | 363590051 |
| 디즈니+ | com.disney.disneyplus | 1446075923 |
| 웨이브 | kr.co.captv.pooqV2 | 1374309498 |
| 쿠팡플레이 | com.coupang.play | 1536885649 |
| 왓챠 | com.frograms.watcha | 1096606674 |

### 1.3 핵심 기능

| 기능 | 설명 |
|------|------|
| **리뷰 수집** | Google Play(최대 1,500건) + App Store(최대 500건) 자동 스크래핑 |
| **AI 감성 분석** | Gemini 2.0 Flash로 칭찬/불만 분류 및 세부 사유 태깅 |
| **통합 대시보드** | 6개 앱 리뷰 현황, 감성 추이, 카테고리 분포 시각화 |
| **전체 리뷰 탐색** | 검색, 카테고리/별점/월별 필터, 테이블 뷰, 페이지네이션 |
| **월간 인사이트** | AI 기반 월간 리포트 - 트렌드 요약, 개선 과제(PRD 포함) |
| **앱 비교** | 6개 OTT 서비스 간 점수, 긍정률, 카테고리 비교 |
| **Excel 다운로드** | 월별 통계, 카테고리별 통계, 전체 리뷰 3시트 엑셀 내보내기 |
| **전체 일괄 수집** | 통합 대시보드에서 6개 앱 순차 수집 |

### 1.4 사용자 워크플로우

```
[리뷰 수집] → [AI 분석 (자동)] → [대시보드 확인] → [인사이트 리포트] → [개선 과제 도출]
     ↓                ↓                   ↓                  ↓
 GP+AS 스크래핑   Gemini 2.0 Flash   차트/테이블 시각화   PRD 자동 생성
```

---

## 2. 상세 기능 명세

### 2.1 리뷰 수집

- **Google Play**: `google-play-scraper` 라이브러리, 15페이지 x 100건 = 최대 1,500건
- **App Store**: `app-store-scraper` 라이브러리, 최대 10페이지 = 최대 500건
- **언어/국가**: 한국어(ko) / 한국(kr)
- **정렬**: 최신순
- **중복 제거**: `store + id` 조합으로 기존 리뷰와 비교, 신규 리뷰만 AI 분석 (토큰 절약)
- **수집 제한**: 앱당 1일 1회
- **비밀번호 보호**: Salted SHA-256 해시 검증

### 2.2 AI 감성 분석

| 항목 | 상세 |
|------|------|
| 모델 | Gemini 2.0 Flash |
| 배치 크기 | 50건/API 호출 |
| 분류 원칙 | 별점 3~5점 → 칭찬, 별점 1~2점 → 불만 (강제) |
| 세부 분류 | AI가 서브카테고리 리스트에서 선택 |
| 속도 제한 | 유료 2초 / 무료 6초 간격 |
| 재시도 | 3회, 429 에러 시 지수 백오프 (30초, 60초) |
| 폴백 | API 실패 시 점수 기반 자동 분류 |

**카테고리 체계:**

| 대분류 | 세부 사유 |
|--------|----------|
| **칭찬** (3~5점) | 오리지널 콘텐츠, 화질/재생 품질, UI 편리성, 콘텐츠 다양성, 합리적 가격, 자막/더빙 품질, 기타 칭찬 |
| **불만** (1~2점) | 플레이어/재생 오류, 광고 관련 불만, 요금/결제/구독, 콘텐츠 부족/불만, UI/UX 불편, 앱 안정성(크래시/버그), 자막/더빙 품질, 기타 불만 |
| **기타** | 단순 문의, 기능 제안, 미분류 |

### 2.3 월간 인사이트

- **분석 기간**: 6개월 윈도우 (최근 3개월 vs 이전 3개월)
- **스파이크 감지**: 이전 대비 1.5배 이상 증가 시 플래그
- **AI 입력**: 전체 리뷰 통계 + 서브카테고리별 최근 5건 샘플 (150자 제한)
- **출력 구조**:
  - `summary`: 전체 트렌드 요약 (1~2문장)
  - `positiveInsights`: 칭찬 인사이트 (최대 10건, 심각도/직무/스파이크 포함)
  - `negativeInsights`: 불만 인사이트 (최대 10건)
  - `tasks`: 개선 과제 (5~7건, 우선순위 + PRD 포함)
- **PRD 자동 생성**: 문제 정의, 목적, 기대 효과, 핵심 기능, 역할별 담당

**직무 레이블**: 개발, 기획/운영, 디자인, 고객서비스, 대외정책, 콘텐츠, 기타

### 2.4 앱 비교

- 6개 OTT 서비스 평균 별점, 긍정/부정 비율 비교
- 카테고리별 횡단 비교 (가로 막대 차트)
- 필터: 전체/칭찬/불만 카테고리 전환
- 상세 테이블: 서비스별 카테고리 건수

### 2.5 Excel 내보내기

3개 시트 구성:
1. **월별 통계**: 월, 칭찬, 불만, 기타, 총계, 긍정 비율
2. **세부 사유별 통계**: 대분류, 세부사유, 건수
3. **전체 리뷰**: 날짜, 스토어, 별점, 대분류, 세부사유, 내용 (개인정보 제외)

---

## 3. 페이지 구성

| 경로 | 페이지 | 주요 기능 |
|------|--------|----------|
| `/` | 통합 대시보드 | 6개 앱 요약 카드, 전체 수집 버튼 |
| `/compare` | 앱 비교 | 점수/긍정률/카테고리 비교 차트 |
| `/{appId}` | 앱 대시보드 | 통계 카드, 감성 추이 차트, 카테고리 분포, 최근 리뷰 |
| `/{appId}/reviews` | 전체 리뷰 | 검색, 필터(카테고리/별점/월), 테이블, 페이지네이션, Excel 다운로드 |
| `/{appId}/insights` | 인사이트 | 월간 요약, 칭찬/불만 인사이트, 개선 과제(PRD) |

**네비게이션**: 좌측 사이드바 (앱 목록) + 앱별 상단 탭 바 (대시보드/전체 리뷰/인사이트)

---

## 4. API 엔드포인트

### 공개 API (인증 불필요)

| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/api/apps` | 전체 앱 목록 + 마지막 업데이트 시각 |
| GET | `/api/compare` | 앱 비교 데이터 |
| GET | `/api/{appId}/stats` | 월별 통계 |
| GET | `/api/{appId}/reviews` | 리뷰 목록 (필터/페이지네이션 지원) |
| GET | `/api/{appId}/insights` | 월간 인사이트 목록 |
| GET | `/api/{appId}/export` | Excel 다운로드 |

### 보호 API (비밀번호 필요)

| Method | 경로 | 설명 | 타임아웃 |
|--------|------|------|---------|
| POST | `/api/{appId}/batch` | 리뷰 수집 + AI 분석 + 인사이트 생성 | 300초 |
| POST | `/api/{appId}/reanalyze` | 분석오류 리뷰 재처리 | 300초 |
| POST | `/api/{appId}/insights` | 특정 월 인사이트 생성 | - |

**인증 방식**: `{ "password": "..." }` JSON Body → Salted SHA-256 해시 비교

---

## 5. 기술 아키텍처

### 5.1 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| Framework | Next.js (App Router) | 15.5.12 |
| Runtime | React | 19.1.0 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Charts | Recharts | 2.15.3 |
| Icons | Lucide React | 0.563.0 |
| AI | Google Generative AI (Gemini) | 0.24.1 |
| Scraping | google-play-scraper / app-store-scraper | 10.1.2 / 0.18.0 |
| Storage | Local JSON / Google Cloud Storage | 7.18.0 |
| Export | xlsx | 0.18.5 |
| Date | date-fns | 4.1.0 |

### 5.2 프로젝트 구조

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # 루트 레이아웃 (사이드바)
│   ├── page.tsx                 # 통합 대시보드
│   ├── compare/page.tsx         # 앱 비교
│   ├── [appId]/
│   │   ├── layout.tsx           # 앱 레이아웃 (네비게이션 바)
│   │   ├── page.tsx             # 앱 대시보드
│   │   ├── reviews/page.tsx     # 전체 리뷰
│   │   └── insights/page.tsx    # 인사이트
│   └── api/                     # API 라우트
│       ├── apps/route.ts
│       ├── compare/route.ts
│       └── [appId]/
│           ├── batch/route.ts
│           ├── reviews/route.ts
│           ├── insights/route.ts
│           ├── stats/route.ts
│           ├── export/route.ts
│           └── reanalyze/route.ts
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx          # 좌측 사이드바
│   │   └── app-navbar.tsx       # 앱별 상단 탭 바
│   ├── dashboard/
│   │   ├── stat-cards.tsx       # KPI 통계 카드
│   │   ├── sentiment-chart.tsx  # 감성 추이 차트
│   │   └── recent-reviews.tsx   # 최근 리뷰 그리드
│   ├── reviews/
│   │   └── review-list.tsx      # 리뷰 테이블 + 필터
│   ├── compare/
│   │   └── compare-client.tsx   # 비교 차트/테이블
│   ├── update-button.tsx        # 개별 앱 수집 버튼
│   └── batch-all-button.tsx     # 전체 수집 버튼
└── lib/
    ├── types.ts                 # 타입 정의
    ├── apps.ts                  # 앱 설정 + 카테고리
    ├── auth.ts                  # 비밀번호 검증 (salt+hash)
    ├── storage.ts               # 저장소 (로컬/GCS)
    ├── scrapers.ts              # 앱스토어 스크래퍼
    ├── ai.ts                    # Gemini AI 분석
    ├── insight-generator.ts     # 인사이트 생성
    └── excel.ts                 # Excel 파일 생성
```

### 5.3 데이터 저장

```
data/{appId}/
├── reviews.json     # AnalyzedReview[] (전체 분석된 리뷰)
├── insights.json    # MonthlyInsight[] (월별 인사이트)
└── status.json      # {lastUpdate: ISO string}
```

- **개발**: 로컬 `data/` 폴더
- **프로덕션**: Google Cloud Storage 버킷 (`GCS_BUCKET_NAME` 설정 시)

### 5.4 핵심 데이터 타입

```typescript
// 리뷰
interface AnalyzedReview {
  id: string;
  userName: string;
  date: string;           // ISO 8601
  score: number;           // 1~5
  text: string;
  store: 'google-play' | 'app-store';
  appId: string;
  category: '칭찬' | '불만' | '기타';
  subCategory: string;     // 세부 사유
  analysisDate: string;    // 분석 시점
}

// 인사이트
interface MonthlyInsight {
  month: string;           // YYYY-MM
  summary: string;
  positiveInsights: InsightItem[];
  negativeInsights: InsightItem[];
  tasks: ImprovementTask[];
  generatedAt: string;
}

// 개선 과제
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
    roles: { planning?; development?; design?; marketing? };
  };
}
```

### 5.5 보안

| 항목 | 구현 |
|------|------|
| 비밀번호 해싱 | Salted SHA-256 (16바이트 랜덤 salt) |
| 해시 저장 | `salt_hex:hash_hex` 형식, 환경변수로 관리 |
| API 인증 | POST 요청 body에 비밀번호 전송 → 서버 해시 비교 |
| 환경변수 | `.env` 파일 (`.gitignore` 포함, 소스에 미포함) |
| Excel 개인정보 | 사용자명 제외하고 내보내기 |
| 하위호환 | 기존 salt 없는 SHA-256 해시도 지원 |

### 5.6 디자인 시스템

- **테마**: 다크 모드 전용
- **폰트**: Pretendard (한국어 지원)
- **주요 색상**: Primary #7c3aed (보라), Success #34d399 (초록), Danger #f87171 (빨강)
- **컴포넌트**: Card(rounded-xl), Button(rounded-full/lg), Input(rounded-xl)
- **레이아웃**: 반응형 그리드 (1/2/3열)

---

## 6. 배포

### 6.1 로컬 개발

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env 파일에 GEMINI_API_KEY, UPDATE_PASSWORD_HASH 설정

# 3. 개발 서버 실행 (port 3001)
npm run dev
```

### 6.2 Docker

```bash
docker build -t appscope .
docker run -p 8080:8080 \
  -e GEMINI_API_KEY=... \
  -e UPDATE_PASSWORD_HASH=... \
  appscope
```

### 6.3 Cloud Run

```bash
gcloud run deploy appscope \
  --source . \
  --project <PROJECT_ID> \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --set-env-vars="GEMINI_API_KEY=...,UPDATE_PASSWORD_HASH=...,GCS_BUCKET_NAME=...,GEMINI_FAST_MODE=true" \
  --memory=1Gi \
  --timeout=300
```

### 6.3 환경변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `GEMINI_API_KEY` | O | Google Gemini API 키 |
| `UPDATE_PASSWORD_HASH` | O | 비밀번호 해시 (`salt_hex:hash_hex`) |
| `GCS_BUCKET_NAME` | - | 프로덕션 GCS 버킷명 |
| `GEMINI_FAST_MODE` | - | `true`: 유료 2초 딜레이 / `false`: 무료 6초 |

**비밀번호 해시 생성:**
```bash
node -e "const c=require('crypto'),s=c.randomBytes(16),h=c.createHash('sha256').update(Buffer.concat([s,Buffer.from('YOUR_PASSWORD')])).digest('hex');console.log(s.toString('hex')+':'+h)"
```

---

## 7. 비용

### Gemini 2.0 Flash (유료 기준)

| 항목 | 1회 비용 | 월간 (주 1회) |
|------|---------|-------------|
| 주간 리뷰 수집+분석 (신규만) | ~₩1 | ~₩5 |
| 인사이트 생성 (6개 앱) | ~₩156 | ~₩624 |
| **합계** | | **~₩630/월** |

### 인프라

| 항목 | 비용 |
|------|------|
| Cloud Run | ₩0 (무료 티어) |
| GCS 스토리지 | ₩0 (수 MB, 무료 5GB 내) |
