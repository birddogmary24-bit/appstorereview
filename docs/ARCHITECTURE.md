# AppScope - 아키텍처 설계서

> 버전: 1.0
> 최종 수정일: 2026-02-25

---

## 1. 시스템 개요

AppScope는 **Next.js 기반 풀스택 웹 애플리케이션**으로, 외부 앱스토어 데이터를 수집하고 AI로 분석한 결과를 웹 대시보드로 제공한다.

### 1.1 핵심 원칙

- **서버리스 우선**: Cloud Run(컨테이너 기반 서버리스)으로 배포, 요청 기반 스케일링
- **단순성**: 별도 DB 없이 JSON 파일 기반 저장 (GCS)
- **비용 최소화**: 무료 티어 최대 활용 (Cloud Run + GCS + Gemini Free)
- **모노리스**: 프론트엔드/API/비즈니스 로직을 단일 Next.js 앱으로 통합

---

## 2. 전체 시스템 구성도

```
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 브라우저                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────────┐
│                    Cloud Run (AppScope)                           │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Next.js 15 (App Router)                │    │
│  │                                                          │    │
│  │  ┌──────────────┐    ┌──────────────────────────────┐   │    │
│  │  │   React UI   │    │       API Routes             │   │    │
│  │  │  (클라이언트) │    │   /api/[appId]/batch         │   │    │
│  │  │              │    │   /api/[appId]/reviews       │   │    │
│  │  │  Dashboard   │    │   /api/[appId]/insights      │   │    │
│  │  │  Compare     │    │   /api/[appId]/stats         │   │    │
│  │  │  Reviews     │    │   /api/[appId]/export        │   │    │
│  │  │  Insights    │    │   /api/apps                  │   │    │
│  │  └──────────────┘    └──────────────────────────────┘   │    │
│  │                                                          │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │               비즈니스 로직 (lib/)               │    │    │
│  │  │  storage.ts │ ai.ts │ scrapers.ts │ auth.ts     │    │    │
│  │  │  insight-generator.ts │ excel.ts │ apps.ts      │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
└───────────┬────────────────────────┬────────────────────────────┘
            │                        │
            │ HTTPS                  │ HTTPS
┌───────────▼──────────┐  ┌──────────▼──────────────────────────┐
│  Google Gemini API   │  │     Google Cloud Storage (GCS)       │
│  (AI 감성 분석)       │  │                                      │
│  - gemini-2.0-flash  │  │  gs://{BUCKET}/{appId}/              │
└──────────────────────┘  │  ├── reviews.json                    │
                          │  ├── insights.json                   │
┌─────────────────────┐   │  └── status.json                     │
│  앱스토어 (외부)     │   └─────────────────────────────────────┘
│  - Google Play      │
│  - Apple App Store  │
└─────────────────────┘
```

---

## 3. 배포 아키텍처

### 3.1 프로덕션 환경

```
┌─────────────────────────────────────────────────────────────┐
│                      Google Cloud Platform                    │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    Cloud Run                           │  │
│  │  - 이미지: Artifact Registry                           │  │
│  │  - 메모리: 1GB                                         │  │
│  │  - 타임아웃: 300초                                     │  │
│  │  - 인증: 없음 (--allow-unauthenticated)                │  │
│  │  - 리전: asia-northeast3 (서울)                        │  │
│  └──────────────────────────┬────────────────────────────┘  │
│                             │                                 │
│  ┌──────────────────────────▼────────────────────────────┐  │
│  │                  Cloud Storage (GCS)                   │  │
│  │  메인 버킷: ${GCS_BUCKET_NAME}                         │  │
│  │  백업 버킷: ${GCS_BACKUP_BUCKET_NAME}                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Cloud Scheduler (선택)                    │  │
│  │  - 주 1회 collect 자동 실행                             │  │
│  │  - Cloud Build로 Docker 이미지 빌드                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 로컬 개발 환경

```
개발자 PC
├── Next.js dev server (port 3001)
├── 로컬 data/ 폴더 (JSON 파일 직접 저장)
└── .env 파일 (환경변수 로컬 관리)
```

### 3.3 컨테이너 구성

**메인 앱 (Dockerfile):**
- Base: `node:20-alpine`
- 포트: 8080
- 실행: `next start`

**수집 전용 컨테이너 (Dockerfile.collect):**
- Base: `node:20-alpine`
- 실행: `node scripts/collect.mjs`
- Cloud Scheduler에 의해 주기적으로 실행

---

## 4. 데이터 흐름

### 4.1 리뷰 수집 흐름

```
사용자 (클릭)
    │
    ▼
POST /api/{appId}/batch
    │ 비밀번호 검증
    ▼
scrapers.ts
    ├── google-play-scraper → Google Play API
    └── app-store-scraper   → Apple App Store RSS
    │
    ▼ 수집된 원시 리뷰
중복 필터링 (store+id 기준)
    │
    ▼ 신규 리뷰만
ai.ts (Gemini 2.0 Flash)
    ├── 배치 50건씩 분할
    ├── 프롬프트 생성
    ├── AI API 호출
    └── 결과 파싱 (대분류 강제 적용, 세부 사유 검증)
    │
    ▼ 분석된 리뷰
storage.ts
    ├── 기존 reviews.json과 병합
    └── GCS 또는 로컬 저장
    │
    ▼
insight-generator.ts (Gemini)
    ├── 6개월 데이터 집계
    ├── 스파이크 감지
    └── AI 인사이트 생성
    │
    ▼
storage.ts → insights.json 저장
```

### 4.2 조회 흐름

```
사용자 (브라우저)
    │
    ▼
React 컴포넌트 (클라이언트)
    │ fetch()
    ▼
GET /api/{appId}/reviews (또는 stats, insights 등)
    │
    ▼
storage.ts
    ├── GCS에서 JSON 다운로드 (프로덕션)
    └── 로컬 파일 읽기 (개발)
    │
    ▼
필터링 / 페이지네이션 처리
    │
    ▼
JSON 응답 → React 상태 업데이트 → UI 렌더링
```

---

## 5. 기술 스택

### 5.1 프론트엔드

| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 15.x (App Router) | 풀스택 프레임워크 |
| React | 19.x | UI 라이브러리 |
| TypeScript | 5.x | 타입 안전성 |
| Tailwind CSS | 4.x | 스타일링 |
| Recharts | 2.x | 차트 컴포넌트 |
| Lucide React | 0.x | 아이콘 |
| xlsx | 0.18.x | Excel 생성 |
| date-fns | 4.x | 날짜 처리 |

### 5.2 백엔드 (API Routes)

| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js API Routes | 15.x | REST API 엔드포인트 |
| Node.js | 20.x | 런타임 |
| google-play-scraper | 10.x | Google Play 수집 |
| app-store-scraper | 0.18.x | App Store 수집 |
| @google/generative-ai | 0.24.x | Gemini AI SDK |
| @google-cloud/storage | 7.x | GCS SDK |

### 5.3 인프라

| 서비스 | 용도 | 비용 |
|--------|------|------|
| Google Cloud Run | 웹 서버 호스팅 | 무료 티어 |
| Google Cloud Storage | 데이터 저장 | 무료 5GB |
| Google Gemini API | AI 분석 | ~₩630/월 |
| Google Cloud Build | CI/CD 이미지 빌드 | 무료 티어 |
| Google Cloud Scheduler | 자동 수집 | 무료 티어 |

---

## 6. 프로젝트 구조

```
appstorereview/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # 루트 레이아웃 (사이드바 포함)
│   │   ├── page.tsx                  # 통합 대시보드 (/)
│   │   ├── compare/
│   │   │   └── page.tsx              # 앱 비교 (/compare)
│   │   ├── [appId]/
│   │   │   ├── layout.tsx            # 앱 레이아웃 (탭 네비)
│   │   │   ├── page.tsx              # 앱 대시보드 (/{appId})
│   │   │   ├── reviews/
│   │   │   │   └── page.tsx          # 전체 리뷰 (/{appId}/reviews)
│   │   │   └── insights/
│   │   │       └── page.tsx          # 인사이트 (/{appId}/insights)
│   │   └── api/                      # API 라우트 (서버사이드)
│   │       ├── apps/route.ts         # GET /api/apps
│   │       ├── compare/route.ts      # GET /api/compare
│   │       └── [appId]/
│   │           ├── batch/route.ts    # POST /api/{appId}/batch
│   │           ├── reviews/route.ts  # GET /api/{appId}/reviews
│   │           ├── insights/route.ts # GET,POST /api/{appId}/insights
│   │           ├── stats/route.ts    # GET /api/{appId}/stats
│   │           ├── export/route.ts   # GET /api/{appId}/export
│   │           └── reanalyze/route.ts# POST /api/{appId}/reanalyze
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx           # 좌측 사이드바
│   │   │   └── app-navbar.tsx        # 앱별 상단 탭 바
│   │   ├── dashboard/
│   │   │   ├── stat-cards.tsx        # KPI 통계 카드
│   │   │   ├── sentiment-chart.tsx   # 감성 추이 차트
│   │   │   └── recent-reviews.tsx    # 최근 리뷰 그리드
│   │   ├── compare/
│   │   │   └── compare-client.tsx    # 비교 차트/테이블
│   │   ├── reviews/
│   │   │   └── review-list.tsx       # 리뷰 테이블 + 필터
│   │   ├── update-button.tsx         # 개별 앱 수집 버튼
│   │   └── batch-all-button.tsx      # 전체 수집 버튼
│   └── lib/                          # 비즈니스 로직
│       ├── types.ts                  # 전체 타입 정의
│       ├── apps.ts                   # 앱 설정 + 카테고리 상수
│       ├── auth.ts                   # 비밀번호 검증 로직
│       ├── storage.ts                # GCS/로컬 파일 추상화
│       ├── scrapers.ts               # 앱스토어 스크래퍼
│       ├── ai.ts                     # Gemini AI 분석
│       ├── insight-generator.ts      # 인사이트 생성
│       └── excel.ts                  # Excel 파일 생성
├── scripts/
│   ├── collect.mjs                   # CLI 수집 스크립트 (Cloud Scheduler용)
│   ├── lifecycle.json                # GCS 메인 버킷 lifecycle 정책
│   └── backup-lifecycle.json         # GCS 백업 버킷 lifecycle 정책
├── docs/                             # 문서
├── Dockerfile                        # 메인 앱 컨테이너
├── Dockerfile.collect                # 수집 전용 컨테이너
├── cloudbuild-collect.yaml           # Cloud Build 수집 이미지 빌드 설정
├── .env.example                      # 환경변수 템플릿
├── package.json
└── tsconfig.json
```

---

## 7. 핵심 모듈 설계

### 7.1 storage.ts - 저장소 추상화

환경에 따라 GCS 또는 로컬 파일시스템을 자동 선택한다.

```
readData(appId, filename)
    ├── IS_PRODUCTION=true → GCS bucket.file().download()
    └── IS_PRODUCTION=false → fs.readFile()

writeData(appId, filename, data)
    ├── IS_PRODUCTION=true → GCS bucket.file().save()
    └── IS_PRODUCTION=false → fs.writeFile()
```

**IS_PRODUCTION 판단 조건:**
```
NODE_ENV === 'production' && GCS_BUCKET_NAME 설정됨
```

### 7.2 auth.ts - 인증 모듈

```
verifyPassword(inputPassword)
    ├── UPDATE_PASSWORD_HASH 환경변수 읽기
    ├── 미설정 시 → true 반환 (보호 없음, 개발용)
    ├── 콜론(:) 포함 → Salted SHA-256 검증
    │     salt = hash.split(':')[0]
    │     expected = sha256(salt + input)
    │     return expected === stored
    └── 콜론 없음 → 레거시 SHA-256 검증 (하위호환)
```

### 7.3 ai.ts - AI 분석 모듈

```
categorizeReviews(reviews, app)
    ├── GEMINI_API_KEY 없음 → 별점 기반 폴백
    ├── 50건 배치 분할
    ├── 각 배치:
    │     ├── 프롬프트 생성 (앱명, 별점, 리뷰 내용)
    │     ├── Gemini API 호출
    │     ├── JSON 파싱
    │     ├── 별점 기반 대분류 강제 적용
    │     └── 허용된 세부 사유 목록으로 검증
    └── 실패 시 분석오류 태그
```

### 7.4 insight-generator.ts - 인사이트 생성

```
generateInsight(month, reviews, app)
    ├── 최근 6개월 데이터 필터링
    ├── 세부 사유별 통계 집계
    ├── 스파이크 감지 (이전 3개월 vs 현재 3개월, 1.5배 기준)
    ├── 사유별 최신 5건 샘플 추출 (150자 제한)
    └── Gemini API → JSON 구조 인사이트 생성
```

---

## 8. 보안 아키텍처

```
인터넷
    │
    ▼ HTTPS (Cloud Run 자동 TLS)
Cloud Run
    │
    ├── GET API → 인증 없음 (공개 데이터)
    │
    └── POST API → verifyPassword()
                    ├── 실패: 401 반환
                    └── 성공: 수집/분석 실행
                              │
                              ├── Gemini API (HTTPS)
                              └── GCS (서비스 계정 인증)
```

**환경변수 보안 흐름:**
```
Cloud Run 환경변수 설정
    └── process.env.GEMINI_API_KEY
    └── process.env.UPDATE_PASSWORD_HASH
    └── process.env.GCS_BUCKET_NAME
         → 소스코드에는 절대 미포함
```

---

## 9. 신규 환경 세팅 가이드

### 9.1 필수 준비사항

1. **Google Cloud 프로젝트** 신규 생성
2. **GCS 버킷** 생성 (메인 + 백업)
3. **Gemini API 키** 발급 (Google AI Studio)
4. **Cloud Run** 배포 권한 설정

### 9.2 환경변수 설정

```bash
# .env 파일 생성 (로컬 개발)
cp .env.example .env

# 비밀번호 해시 생성
node -e "const c=require('crypto'),s=c.randomBytes(16),h=c.createHash('sha256').update(Buffer.concat([s,Buffer.from('원하는비밀번호')])).digest('hex');console.log(s.toString('hex')+':'+h)"

# .env 파일 편집
GEMINI_API_KEY=발급받은_키
UPDATE_PASSWORD_HASH=생성된_해시값
GCS_BUCKET_NAME=생성한_버킷명
GCS_BACKUP_BUCKET_NAME=생성한_백업버킷명
GEMINI_FAST_MODE=false
```

### 9.3 로컬 실행

```bash
npm install
npm run dev
# → http://localhost:3001 접속
```

### 9.4 Cloud Run 배포

```bash
gcloud run deploy appscope \
  --source . \
  --project {PROJECT_ID} \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --set-env-vars="GEMINI_API_KEY=...,UPDATE_PASSWORD_HASH=...,GCS_BUCKET_NAME=...,GEMINI_FAST_MODE=true" \
  --memory=1Gi \
  --timeout=300
```

### 9.5 GCS Lifecycle 정책 적용

```bash
# 메인 버킷 lifecycle 설정
gsutil lifecycle set scripts/lifecycle.json gs://{GCS_BUCKET_NAME}

# 백업 버킷 lifecycle 설정
gsutil lifecycle set scripts/backup-lifecycle.json gs://{GCS_BACKUP_BUCKET_NAME}
```
