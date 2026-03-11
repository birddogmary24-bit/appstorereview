import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'AppScope API',
    description: `OTT 앱 리뷰 분석 플랫폼 API입니다.\n\n## 인증\nAPI 키를 통해 인증합니다. \`Authorization: Bearer <API_KEY>\` 헤더 또는 \`?apiKey=<API_KEY>\` 쿼리 파라미터를 사용하세요.\n\n## 호출 제한\n- **일일 한도**: 2회/일\n- **월간 한도**: 4회/월\n\n응답 헤더에서 잔여 호출 횟수를 확인할 수 있습니다:\n- \`X-RateLimit-Daily-Remaining\`\n- \`X-RateLimit-Monthly-Remaining\`\n\n## API 키 발급\n관리자에게 문의하거나, 관리자 비밀번호로 \`POST /api/v1/admin/api-keys\`를 호출하세요.`,
    version: '1.0.0',
  },
  servers: [
    { url: '/', description: 'Current server' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'API 키를 Bearer 토큰으로 전달',
      },
      ApiKeyQuery: {
        type: 'apiKey',
        in: 'query',
        name: 'apiKey',
        description: 'API 키를 쿼리 파라미터로 전달',
      },
    },
    schemas: {
      Review: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          date: { type: 'string', format: 'date-time' },
          score: { type: 'integer', minimum: 1, maximum: 5 },
          title: { type: 'string', nullable: true },
          text: { type: 'string' },
          store: { type: 'string', enum: ['google-play', 'app-store'] },
          appId: { type: 'string' },
          category: { type: 'string', enum: ['칭찬', '불만', '기타'] },
          subCategory: { type: 'string' },
          analysisDate: { type: 'string', format: 'date-time' },
        },
      },
      MonthlyStats: {
        type: 'object',
        properties: {
          month: { type: 'string', example: '2025-01' },
          complaints: { type: 'integer' },
          compliments: { type: 'integer' },
          others: { type: 'integer' },
          total: { type: 'integer' },
        },
      },
      InsightItem: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          count: { type: 'integer' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          sentiment: { type: 'string', enum: ['positive', 'negative'] },
          isSpiked: { type: 'boolean' },
          jobLabels: { type: 'array', items: { type: 'string' } },
          relatedSubCategories: { type: 'array', items: { type: 'string' } },
        },
      },
      MonthlyInsight: {
        type: 'object',
        properties: {
          month: { type: 'string' },
          summary: { type: 'string' },
          positiveInsights: { type: 'array', items: { $ref: '#/components/schemas/InsightItem' } },
          negativeInsights: { type: 'array', items: { $ref: '#/components/schemas/InsightItem' } },
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                jobLabels: { type: 'array', items: { type: 'string' } },
                prd: { type: 'object', nullable: true },
              },
            },
          },
          generatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
        },
      },
      RateLimitError: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          remaining: {
            type: 'object',
            properties: {
              daily: { type: 'integer' },
              monthly: { type: 'integer' },
            },
          },
        },
      },
    },
    parameters: {
      AppId: {
        name: 'appId',
        in: 'path',
        required: true,
        schema: { type: 'string', enum: ['tving', 'netflix', 'disneyplus', 'wavve', 'coupangplay', 'watcha'] },
        description: 'OTT 앱 ID',
      },
    },
  },
  security: [{ BearerAuth: [] }, { ApiKeyQuery: [] }],
  paths: {
    '/api/v1/apps': {
      get: {
        tags: ['앱'],
        summary: 'OTT 앱 목록 조회',
        description: '전체 OTT 앱 목록 및 마지막 데이터 업데이트 시간을 반환합니다.',
        responses: {
          '200': {
            description: '성공',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          icon: { type: 'string' },
                          lastUpdate: { type: 'string', nullable: true },
                        },
                      },
                    },
                    meta: { type: 'object', properties: { total: { type: 'integer' } } },
                  },
                },
              },
            },
          },
          '401': { description: '인증 실패', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '429': { description: '호출 한도 초과', content: { 'application/json': { schema: { $ref: '#/components/schemas/RateLimitError' } } } },
        },
      },
    },
    '/api/v1/apps/{appId}/reviews': {
      get: {
        tags: ['리뷰'],
        summary: '리뷰 목록 조회',
        description: '특정 앱의 리뷰를 필터링 및 페이지네이션하여 조회합니다. 개인정보 보호를 위해 사용자 이름은 제외됩니다.',
        parameters: [
          { $ref: '#/components/parameters/AppId' },
          { name: 'category', in: 'query', schema: { type: 'string', enum: ['칭찬', '불만', '기타'] }, description: '카테고리 필터' },
          { name: 'subCategory', in: 'query', schema: { type: 'string' }, description: '서브카테고리 필터' },
          { name: 'minScore', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 5 }, description: '최소 평점' },
          { name: 'maxScore', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 5 }, description: '최대 평점' },
          { name: 'store', in: 'query', schema: { type: 'string', enum: ['google-play', 'app-store'] }, description: '스토어 필터' },
          { name: 'month', in: 'query', schema: { type: 'string', example: '2025-01' }, description: '월 필터 (YYYY-MM)' },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: '리뷰 텍스트 검색어' },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: '페이지 번호' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 30, maximum: 100 }, description: '페이지당 항목 수 (최대 100)' },
        ],
        responses: {
          '200': {
            description: '성공',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Review' } },
                    meta: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer' },
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        totalPages: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { description: '인증 실패' },
          '404': { description: '앱을 찾을 수 없음' },
          '429': { description: '호출 한도 초과' },
        },
      },
    },
    '/api/v1/apps/{appId}/stats': {
      get: {
        tags: ['통계'],
        summary: '월별 통계 조회',
        description: '특정 앱의 월별 리뷰 통계 (칭찬/불만/기타 건수)를 조회합니다.',
        parameters: [{ $ref: '#/components/parameters/AppId' }],
        responses: {
          '200': {
            description: '성공',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/MonthlyStats' } },
                    meta: {
                      type: 'object',
                      properties: {
                        appId: { type: 'string' },
                        appName: { type: 'string' },
                        totalMonths: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { description: '인증 실패' },
          '404': { description: '앱을 찾을 수 없음' },
          '429': { description: '호출 한도 초과' },
        },
      },
    },
    '/api/v1/apps/{appId}/insights': {
      get: {
        tags: ['인사이트'],
        summary: '월별 인사이트 조회',
        description: 'AI가 생성한 월별 인사이트 리포트를 조회합니다. 긍정/부정 트렌드, 개선 과제 (PRD 포함)가 포함됩니다.',
        parameters: [
          { $ref: '#/components/parameters/AppId' },
          { name: 'month', in: 'query', schema: { type: 'string', example: '2025-01' }, description: '특정 월 필터 (YYYY-MM)' },
        ],
        responses: {
          '200': {
            description: '성공',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/MonthlyInsight' } },
                    meta: {
                      type: 'object',
                      properties: {
                        appId: { type: 'string' },
                        appName: { type: 'string' },
                        total: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { description: '인증 실패' },
          '404': { description: '앱을 찾을 수 없음' },
          '429': { description: '호출 한도 초과' },
        },
      },
    },
    '/api/v1/apps/{appId}/categories': {
      get: {
        tags: ['카테고리'],
        summary: '카테고리별 리뷰 분포 조회',
        description: '특정 앱의 대분류(칭찬/불만/기타) 및 서브카테고리별 리뷰 건수 분포를 조회합니다.',
        parameters: [{ $ref: '#/components/parameters/AppId' }],
        responses: {
          '200': {
            description: '성공',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        totalReviews: { type: 'integer' },
                        categories: { type: 'object', additionalProperties: { type: 'integer' } },
                        subCategories: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              name: { type: 'string' },
                              count: { type: 'integer' },
                            },
                          },
                        },
                        availableCategories: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': { description: '인증 실패' },
          '404': { description: '앱을 찾을 수 없음' },
          '429': { description: '호출 한도 초과' },
        },
      },
    },
    '/api/v1/compare': {
      get: {
        tags: ['비교'],
        summary: 'OTT 앱 비교',
        description: '여러 OTT 앱의 리뷰 데이터를 비교합니다. 평점, 긍정/부정 비율, 주요 불만/칭찬 항목을 포함합니다.',
        parameters: [
          { name: 'apps', in: 'query', schema: { type: 'string', example: 'tving,netflix,wavve' }, description: '비교할 앱 ID (쉼표 구분). 생략 시 전체 앱 비교.' },
        ],
        responses: {
          '200': { description: '성공' },
          '401': { description: '인증 실패' },
          '429': { description: '호출 한도 초과' },
        },
      },
    },
    '/api/v1/admin/api-keys': {
      get: {
        tags: ['관리자'],
        summary: 'API 키 목록 조회',
        description: '발급된 모든 API 키 목록을 조회합니다. 관리자 비밀번호가 필요합니다.',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: '성공' },
          '401': { description: '관리자 인증 실패' },
        },
      },
      post: {
        tags: ['관리자'],
        summary: '새 API 키 발급',
        description: '새로운 API 키를 발급합니다. 관리자 비밀번호가 필요합니다. 발급된 키는 한 번만 표시됩니다.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['password', 'name'],
                properties: {
                  password: { type: 'string', description: '관리자 비밀번호' },
                  name: { type: 'string', description: '계정 이름 (예: "팀A", "협력사B")' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'API 키 생성 성공' },
          '400': { description: '잘못된 요청' },
          '401': { description: '관리자 인증 실패' },
        },
      },
      delete: {
        tags: ['관리자'],
        summary: 'API 키 비활성화',
        description: '특정 API 키를 비활성화합니다.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['password', 'keyId'],
                properties: {
                  password: { type: 'string', description: '관리자 비밀번호' },
                  keyId: { type: 'string', description: '비활성화할 API 키 ID' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: '비활성화 성공' },
          '401': { description: '관리자 인증 실패' },
          '404': { description: 'API 키를 찾을 수 없음' },
        },
      },
    },
  },
  tags: [
    { name: '앱', description: 'OTT 앱 정보' },
    { name: '리뷰', description: '리뷰 데이터 조회' },
    { name: '통계', description: '월별 통계' },
    { name: '인사이트', description: 'AI 인사이트 리포트' },
    { name: '카테고리', description: '카테고리 분포' },
    { name: '비교', description: '앱 간 비교' },
    { name: '관리자', description: 'API 키 관리 (관리자 전용)' },
  ],
};

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  });
}
